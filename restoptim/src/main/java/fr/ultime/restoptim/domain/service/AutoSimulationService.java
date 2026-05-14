package fr.ultime.restoptim.domain.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import fr.ultime.restoptim.domain.model.dish.Dish;
import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.model.order.OrderId;
import fr.ultime.restoptim.domain.model.table.Table;
import fr.ultime.restoptim.domain.model.table.TableId;
import fr.ultime.restoptim.domain.model.table.TableStatus;
import fr.ultime.restoptim.domain.spi.Orders;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import fr.ultime.restoptim.domain.model.AutoSimulationLog;
import fr.ultime.restoptim.domain.model.AutoSimulationStatus;
import fr.ultime.restoptim.domain.model.GanttTask;
import fr.ultime.restoptim.domain.spi.Dishes;
import fr.ultime.restoptim.domain.spi.Tables;

@Service
public class AutoSimulationService {

    private static final Logger logger = LoggerFactory.getLogger(AutoSimulationService.class);
    private static final int MAX_LOGS = 200;

    private final Tables tables;
    private final Dishes dishes;
    private final Orders orders;
    private final OrderService orderService;
    private final TimeShiftService timeShiftService;

    private final AtomicBoolean active = new AtomicBoolean(false);
    private final LinkedList<AutoSimulationLog> logs = new LinkedList<>();
    private volatile ScheduledExecutorService executor;
    private volatile double currentSpeedMultiplier = 1.0;
    private final Random random = new Random();
    private final Set<OrderId> servedOrderIds = ConcurrentHashMap.newKeySet();

    public AutoSimulationService(Tables tables, Dishes dishes, Orders orders,
                                 OrderService orderService, TimeShiftService timeShiftService) {
        this.tables = tables;
        this.dishes = dishes;
        this.orders = orders;
        this.orderService = orderService;
        this.timeShiftService = timeShiftService;
    }

    public boolean isActive() {
        return active.get();
    }

    public AutoSimulationStatus getStatus() {
        synchronized (logs) {
            return new AutoSimulationStatus(active.get(), new ArrayList<>(logs));
        }
    }

    public synchronized void start(int durationMin, double arrivalRatePerHour, int avgPartySize, double speedMultiplier) {
        if (active.get()) {
            throw new IllegalStateException("Une simulation est déjà en cours.");
        }
        synchronized (logs) {
            logs.clear();
        }
        servedOrderIds.clear();
        // L'auto-sim travaille en temps réel : on annule tout décalage manuel
        // pour éviter un mélange incohérent des deux mécanismes.
        timeShiftService.reset();
        currentSpeedMultiplier = speedMultiplier;
        active.set(true);

        executor = Executors.newSingleThreadScheduledExecutor();

        addLog("info", String.format("Démarrage — λ=%.1f arr./h, groupe moy.=%d pers., vitesse=%.2f×",
                arrivalRatePerHour, avgPartySize, speedMultiplier));

        // Monitoring des plats terminés toutes les 2 secondes réelles
        executor.scheduleAtFixedRate(this::checkAndServeCompletedTables, 2, 2, TimeUnit.SECONDS);

        // Arrêt automatique à la fin de la durée simulée
        long durationMs = (long) (durationMin * 60_000L * speedMultiplier);
        executor.schedule(this::stopInternal, durationMs, TimeUnit.MILLISECONDS);

        // Première arrivée
        scheduleNextArrival(arrivalRatePerHour, avgPartySize, speedMultiplier);

        logger.info("[AUTO-SIM] Démarrée : durée={}min, λ={}/h, partySize={}, speed={}",
                durationMin, arrivalRatePerHour, avgPartySize, speedMultiplier);
    }

    public synchronized void stop() {
        if (!active.get()) return;
        stopInternal();
    }

    private void stopInternal() {
        if (!active.compareAndSet(true, false)) return;

        ScheduledExecutorService exec = executor;
        if (exec != null) {
            exec.shutdownNow();
            try {
                // Attendre la fin des tâches en cours pour éviter qu'elles écrasent releaseAllTables
                exec.awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            executor = null;
        }

        try {
            releaseAllTables();
            addLog("info", "Simulation arrêtée — toutes les tables ont été libérées.");
        } catch (Exception e) {
            logger.error("[AUTO-SIM] Erreur lors de la libération des tables", e);
            addLog("error", "Erreur lors de l'arrêt : " + e.getMessage());
        }

        logger.info("[AUTO-SIM] Arrêtée.");
    }

    private void scheduleNextArrival(double arrivalRatePerHour, int avgPartySize, double speedMultiplier) {
        ScheduledExecutorService exec = executor;
        if (!active.get() || exec == null || exec.isShutdown()) return;

        // Temps inter-arrivée : loi exponentielle de paramètre λ (en ms simulées)
        double lambdaPerMs = arrivalRatePerHour / 3_600_000.0;
        double u = random.nextDouble();
        long simulatedDelayMs = (long) (-Math.log(u) / lambdaPerMs);
        // Convertir en temps réel via le multiplicateur de vitesse
        long realDelayMs = Math.max(500L, (long) (simulatedDelayMs * speedMultiplier));

        try {
            exec.schedule(() -> {
                if (active.get()) {
                    handleArrival(avgPartySize, speedMultiplier);
                    scheduleNextArrival(arrivalRatePerHour, avgPartySize, speedMultiplier);
                }
            }, realDelayMs, TimeUnit.MILLISECONDS);
        } catch (RejectedExecutionException ignored) {}
    }

    private void handleArrival(int avgPartySize, double speedMultiplier) {
        // Taille du groupe : uniforme entre 1 et min(avgPartySize*2, 8)
        int maxSize = Math.min(avgPartySize * 2, 8);
        int partySize = 1 + random.nextInt(maxSize);

        // Chercher la plus petite table libre de taille suffisante
        Optional<Table> tableOpt = tables.getTables().stream()
                .filter(t -> t.status() == TableStatus.LIBRE && t.seats() >= partySize)
                .min(Comparator.comparingInt(Table::seats));

        if (tableOpt.isEmpty()) {
            addLog("rejected", partySize + " client(s) refusé(s) — aucune table libre disponible");
            return;
        }

        Table table = tableOpt.get();
        addLog("arrival", partySize + " client(s) arrivent → Table " + table.number());

        // Installer le groupe à la table
        try {
            tables.save(new Table(table.id(), table.number(), table.seats(),
                    TableStatus.COMMANDE_PASSEE, partySize, null));
        } catch (Exception e) {
            addLog("error", "Impossible d'installer la table " + table.number() + " : " + e.getMessage());
            return;
        }

        // Sélectionner des plats au hasard dans le menu
        List<Dish> menu = dishes.getDishes();
        if (menu.isEmpty()) {
            addLog("error", "Aucun plat disponible dans le menu.");
            tables.save(new Table(table.id(), table.number(), table.seats(), TableStatus.LIBRE, null, null));
            return;
        }

        List<DishId> dishIds = new ArrayList<>();
        List<String> dishNames = new ArrayList<>();
        for (int i = 0; i < partySize; i++) {
            Dish dish = menu.get(random.nextInt(menu.size()));
            dishIds.add(dish.id());
            dishNames.add(dish.name());
        }

        addLog("order", "Table " + table.number() + " commande : " + String.join(", ", dishNames));

        // Passer la commande via le service métier
        try {
            orderService.placeOrder(table.id(), dishIds, speedMultiplier);
        } catch (Exception e) {
            addLog("error", "Erreur commande Table " + table.number() + " : " + e.getMessage());
            tables.save(new Table(table.id(), table.number(), table.seats(), TableStatus.LIBRE, null, null));
        }
    }

    private void checkAndServeCompletedTables() {
        if (!active.get()) return;
        try {
            long now = System.currentTimeMillis();
            List<GanttTask> ganttTasks = orderService.getAllActiveGanttTasks();

            // Grouper les tâches de dressage par commandeId
            Map<OrderId, List<GanttTask>> platingByCommande = new HashMap<>();
            for (GanttTask task : ganttTasks) {
                if ("dressage".equals(task.kind())) {
                    platingByCommande.computeIfAbsent(task.orderId(), k -> new ArrayList<>()).add(task);
                }
            }

            // Pour chaque commande : si tous les dressages sont terminés → servir la table
            for (Map.Entry<OrderId, List<GanttTask>> entry : platingByCommande.entrySet()) {
                OrderId commandeId = entry.getKey();
                if (servedOrderIds.contains(commandeId)) continue;

                boolean allDone = entry.getValue().stream().allMatch(t -> t.endAt() <= now);
                if (allDone) {
                    servedOrderIds.add(commandeId);
                    serveTableForCommande(commandeId);
                }
            }
        } catch (Exception e) {
            logger.error("[AUTO-SIM] Erreur monitoring serving", e);
        }
    }

    private void serveTableForCommande(OrderId orderId) {
        tables.getTables().stream()
                .filter(t -> Objects.equals(orderId, t.orderId()))
                .findFirst()
                .ifPresent(table -> {
                    try {
                        // Ne pas servir si la simulation s'est arrêtée entre-temps
                        if (!active.get()) return;
                        tables.save(new Table(table.id(), table.number(), table.seats(),
                                TableStatus.SERVIE, table.partySize(), table.orderId()));
                        addLog("served", "Table " + table.number() + " servie — les clients mangent");

                        // Planifier la libération après un temps de repas simulé (20-40 min)
                        long eatingMinSimulated = 20 + random.nextInt(21);
                        long realDelayMs = (long) (eatingMinSimulated * 60_000L * currentSpeedMultiplier);
                        ScheduledExecutorService exec = executor;
                        if (exec != null && !exec.isShutdown()) {
                            exec.schedule(() -> releaseTable(table.id(), table.number()), realDelayMs, TimeUnit.MILLISECONDS);
                        }
                    } catch (Exception e) {
                        logger.error("[AUTO-SIM] Erreur servir table {}", table.number(), e);
                    }
                });
    }

    private void releaseTable(TableId tableId, int tableNumber) {
        if (!active.get()) return;
        try {
            Table table = tables.getTableById(tableId).orElse(null);
            if (table == null || table.status() == TableStatus.LIBRE) return;
            if (table.orderId() != null) {
                orders.closeOrder(table.orderId());
            }
            tables.save(new Table(table.id(), table.number(), table.seats(), TableStatus.LIBRE, null, null));
            addLog("left", "Table " + tableNumber + " libérée — les clients sont partis");
        } catch (Exception e) {
            logger.error("[AUTO-SIM] Erreur libération table {}", tableNumber, e);
        }
    }

    private void releaseAllTables() {
        for (Table t : tables.getTables()) {
            if (t.status() == TableStatus.LIBRE) continue;
            try {
                if (t.orderId() != null) {
                    orders.closeOrder(t.orderId());
                }
                tables.save(new Table(t.id(), t.number(), t.seats(), TableStatus.LIBRE, null, null));
            } catch (Exception e) {
                logger.error("[AUTO-SIM] Erreur libération table {} à l'arrêt", t.number(), e);
            }
        }
    }

    private void addLog(String type, String message) {
        AutoSimulationLog log = new AutoSimulationLog(System.currentTimeMillis(), type, message);
        synchronized (logs) {
            logs.addLast(log);
            if (logs.size() > MAX_LOGS) logs.removeFirst();
        }
        logger.info("[AUTO-SIM] [{}] {}", type, message);
    }
}
