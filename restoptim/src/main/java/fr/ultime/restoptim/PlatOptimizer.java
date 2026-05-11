package fr.ultime.restoptim;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.google.ortools.Loader;
import com.google.ortools.sat.CpModel;
import com.google.ortools.sat.CpSolver;
import com.google.ortools.sat.CpSolverStatus;
import com.google.ortools.sat.IntVar;
import com.google.ortools.sat.IntervalVar;
import com.google.ortools.sat.LinearArgument;
import com.google.ortools.sat.LinearExpr;

public class PlatOptimizer {

    static {
        Loader.loadNativeLibraries();
    }

    public static class Tache {

        private final String nom;
        private final int duree;
        private final List<String> ressources;
        private final String typetache;

        public Tache(String nom, int duree, List<String> ressources, String typetache) {
            if (nom == null || nom.isBlank()) {
                throw new IllegalArgumentException("Le nom de la tâche ne peut pas être vide.");
            }

            if (typetache == null || typetache.isBlank()) {
                throw new IllegalArgumentException("Le type de tâche ne peut pas être vide.");
            }

            if (duree <= 0) {
                throw new IllegalArgumentException("La durée doit être strictement positive.");
            }

            if (ressources == null || ressources.isEmpty()) {
                throw new IllegalArgumentException("Une tâche doit utiliser au moins une ressource.");
            }

            this.nom = nom;
            this.typetache = typetache;
            this.duree = duree;
            this.ressources = ressources;
        }

        public String getTypetache() {
            return typetache;
        }

        public String getNom() {
            return nom;
        }

        public int getDuree() {
            return duree;
        }

        public List<String> getRessources() {
            return ressources;
        }

        public boolean isCuisson() {
            return typetache.equalsIgnoreCase("cuisson");
        }

        public boolean isDressage() {
            return typetache.equalsIgnoreCase("dressage");
        }
    }

    public static class PlatCommande {

        private final String idPlat;
        private final String nomPlat;
        private final List<Tache> taches;

        public PlatCommande(String idPlat, String nomPlat, List<Tache> taches) {
            if (idPlat == null || idPlat.isBlank()) {
                throw new IllegalArgumentException("L'id du plat ne peut pas être vide.");
            }

            if (nomPlat == null || nomPlat.isBlank()) {
                throw new IllegalArgumentException("Le nom du plat ne peut pas être vide.");
            }

            if (taches == null || taches.isEmpty()) {
                throw new IllegalArgumentException("Un plat doit contenir au moins une tâche.");
            }

            this.idPlat = idPlat;
            this.nomPlat = nomPlat;
            this.taches = taches;
        }

        public String getIdPlat() {
            return idPlat;
        }

        public String getNomPlat() {
            return nomPlat;
        }

        public List<Tache> getTaches() {
            return taches;
        }
    }

    public static class TachePlanifiee {

        public final String idPlat;
        public final String nomPlat;
        public final String nom;
        public final String typetache;
        public final long debut;
        public final long fin;
        public final List<String> ressources;

        public TachePlanifiee(
                String idPlat,
                String nomPlat,
                String nom,
                String typetache,
                long debut,
                long fin,
                List<String> ressources
        ) {
            this.idPlat = idPlat;
            this.nomPlat = nomPlat;
            this.nom = nom;
            this.typetache = typetache;
            this.debut = debut;
            this.fin = fin;
            this.ressources = ressources;
        }

        @Override
        public String toString() {
            return "[" + nomPlat + "] "
                    + typetache + " (" + nom + ") : "
                    + debut + " -> " + fin
                    + " | ressources = " + ressources;
        }
    }

    public static class PlanningCommande {

        public final long serviceTime;
        public final List<TachePlanifiee> tachesPlanifiees;

        public PlanningCommande(long serviceTime, List<TachePlanifiee> tachesPlanifiees) {
            this.serviceTime = serviceTime;
            this.tachesPlanifiees = tachesPlanifiees;
        }
    }

    public static PlanningCommande optimiserCommande(List<PlatCommande> plats) {
        return optimiserCommande(plats, 10, 20);
    }

    public static PlanningCommande optimiserCommande(
            List<PlatCommande> plats,
            int toleranceAvantDressage,
            int toleranceService
    ) {
        if (plats == null || plats.isEmpty()) {
            throw new IllegalArgumentException("La commande doit contenir au moins un plat.");
        }

        if (toleranceAvantDressage < 0) {
            throw new IllegalArgumentException("La tolérance avant dressage ne peut pas être négative.");
        }

        if (toleranceService < 0) {
            throw new IllegalArgumentException("La tolérance de service ne peut pas être négative.");
        }

        verifierIdsPlatsUniques(plats);
        verifierDressageParPlat(plats);
        verifierNomsTachesUniquesDansChaquePlat(plats);

        CpModel model = new CpModel();

        int horizon = plats.stream()
                .flatMap(plat -> plat.getTaches().stream())
                .mapToInt(Tache::getDuree)
                .sum() + toleranceAvantDressage + toleranceService + 60;

        Map<String, IntVar> starts = new HashMap<>();
        Map<String, IntVar> ends = new HashMap<>();
        Map<String, List<IntervalVar>> resourceIntervals = new HashMap<>();

        // 1. Initialiser toutes les ressources de tous les plats.
        for (PlatCommande plat : plats) {
            for (Tache tache : plat.getTaches()) {
                for (String ressource : tache.getRessources()) {
                    resourceIntervals.putIfAbsent(ressource, new ArrayList<>());
                }
            }
        }

        // 2. Créer les variables OR-Tools pour toutes les tâches de tous les plats.
        for (PlatCommande plat : plats) {
            for (Tache tache : plat.getTaches()) {
                String key = key(plat, tache);

                IntVar start = model.newIntVar(0, horizon, "start_" + key);
                IntVar end = model.newIntVar(0, horizon, "end_" + key);

                IntervalVar interval = model.newIntervalVar(
                        start,
                        LinearExpr.constant(tache.getDuree()),
                        end,
                        "interval_" + key
                );

                starts.put(key, start);
                ends.put(key, end);

                for (String ressource : tache.getRessources()) {
                    resourceIntervals.get(ressource).add(interval);
                }
            }
        }

        // 3. NoOverlap global :
        // Une ressource est partagée par toute la commande.
        // Donc le même chef, commis, four ou plaque ne peut pas faire deux tâches en même temps.
        for (List<IntervalVar> intervalsForResource : resourceIntervals.values()) {
            model.addNoOverlap(intervalsForResource);
        }

        // 4. Pour chaque plat :
        // - le dressage attend toutes les autres tâches du même plat ;
        // - les cuissons finissent proche du dressage du même plat.
        List<IntVar> attentesCuissons = new ArrayList<>();
        List<IntVar> finsDressage = new ArrayList<>();

        for (PlatCommande plat : plats) {
            Tache dressage = trouverDressage(plat);

            String dressageKey = key(plat, dressage);

            IntVar startDressage = starts.get(dressageKey);
            IntVar endDressage = ends.get(dressageKey);

            finsDressage.add(endDressage);

            for (Tache tache : plat.getTaches()) {
                if (!tache.isDressage()) {
                    String tacheKey = key(plat, tache);

                    model.addGreaterOrEqual(
                            startDressage,
                            ends.get(tacheKey)
                    );
                }
            }

            for (Tache tache : plat.getTaches()) {
                if (tache.isCuisson()) {
                    String cuissonKey = key(plat, tache);
                    IntVar endCuisson = ends.get(cuissonKey);

                    model.addLessOrEqual(endCuisson, startDressage);

                    model.addGreaterOrEqual(
                            endCuisson,
                            LinearExpr.affine(startDressage, 1, -toleranceAvantDressage)
                    );

                    IntVar attente = model.newIntVar(
                            0,
                            toleranceAvantDressage,
                            "attente_" + cuissonKey
                    );

                    model.addEquality(
                            attente,
                            LinearExpr.weightedSum(
                                    new LinearArgument[]{startDressage, endCuisson},
                                    new long[]{1, -1}
                            )
                    );

                    attentesCuissons.add(attente);
                }
            }
        }

        // 5. Service commun pour toute la commande.
        // Tous les dressages doivent finir proche de serviceTime.
        IntVar serviceTime = model.newIntVar(0, horizon, "service_time");

        List<IntVar> attentesService = new ArrayList<>();

        for (int i = 0; i < finsDressage.size(); i++) {
            IntVar finDressage = finsDressage.get(i);

            // Le plat doit être dressé avant ou au moment du service.
            model.addLessOrEqual(finDressage, serviceTime);

            // Le plat ne doit pas attendre trop longtemps avant le service.
            model.addGreaterOrEqual(
                    finDressage,
                    LinearExpr.affine(serviceTime, 1, -toleranceService)
            );

            // attenteService = serviceTime - finDressage
            IntVar attente = model.newIntVar(
                    0,
                    toleranceService,
                    "attente_service_plat_" + i
            );

            model.addEquality(
                    attente,
                    LinearExpr.weightedSum(
                            new LinearArgument[]{serviceTime, finDressage},
                            new long[]{1, -1}
                    )
            );

            attentesService.add(attente);
        }

        // 6. Objectif :
        // priorité 1 : servir la commande le plus tôt possible ;
        // priorité 2 : faire finir les dressages le plus proche du service ;
        // priorité 3 : faire finir les cuissons le plus proche du dressage.
        List<LinearArgument> objectifVars = new ArrayList<>();
        List<Long> objectifCoeffs = new ArrayList<>();

        objectifVars.add(serviceTime);
        objectifCoeffs.add(1000L);

        for (IntVar attente : attentesService) {
            objectifVars.add(attente);
            objectifCoeffs.add(50L);
        }

        for (IntVar attente : attentesCuissons) {
            objectifVars.add(attente);
            objectifCoeffs.add(1L);
        }

        LinearExpr objectif = LinearExpr.weightedSum(
                objectifVars.toArray(new LinearArgument[0]),
                objectifCoeffs.stream().mapToLong(Long::longValue).toArray()
        );

        model.minimize(objectif);

        // 7. Résolution.
        CpSolver solver = new CpSolver();
        solver.getParameters().setMaxTimeInSeconds(5.0);

        CpSolverStatus status = solver.solve(model);

        if (status != CpSolverStatus.OPTIMAL && status != CpSolverStatus.FEASIBLE) {
            throw new RuntimeException(
                    "Aucune solution trouvée. Essayez d’augmenter toleranceAvantDressage ou toleranceService."
            );
        }

        // 8. Construction du planning.
        List<TachePlanifiee> planning = new ArrayList<>();

        for (PlatCommande plat : plats) {
            for (Tache tache : plat.getTaches()) {
                String tacheKey = key(plat, tache);

                planning.add(new TachePlanifiee(
                        plat.getIdPlat(),
                        plat.getNomPlat(),
                        tache.getNom(),
                        tache.getTypetache(),
                        solver.value(starts.get(tacheKey)),
                        solver.value(ends.get(tacheKey)),
                        tache.getRessources()
                ));
            }
        }

        planning.sort(Comparator.comparingLong(t -> t.debut));

        return new PlanningCommande(
                solver.value(serviceTime),
                planning
        );
    }

    private static String key(PlatCommande plat, Tache tache) {
        return plat.getIdPlat() + "_" + tache.getNom();
    }

    private static Tache trouverDressage(PlatCommande plat) {
        List<Tache> dressages = plat.getTaches().stream()
                .filter(Tache::isDressage)
                .toList();

        if (dressages.size() != 1) {
            throw new IllegalArgumentException(
                    "Le plat " + plat.getNomPlat() + " doit avoir exactement une tâche de dressage."
            );
        }

        return dressages.get(0);
    }

    private static void verifierIdsPlatsUniques(List<PlatCommande> plats) {
        Set<String> ids = new HashSet<>();

        for (PlatCommande plat : plats) {
            if (!ids.add(plat.getIdPlat())) {
                throw new IllegalArgumentException(
                        "Deux plats ont le même id : " + plat.getIdPlat()
                );
            }
        }
    }

    private static void verifierDressageParPlat(List<PlatCommande> plats) {
        for (PlatCommande plat : plats) {
            trouverDressage(plat);
        }
    }

    private static void verifierNomsTachesUniquesDansChaquePlat(List<PlatCommande> plats) {
        for (PlatCommande plat : plats) {
            Set<String> noms = new HashSet<>();

            for (Tache tache : plat.getTaches()) {
                if (!noms.add(tache.getNom())) {
                    throw new IllegalArgumentException(
                            "Dans le plat " + plat.getNomPlat()
                                    + ", deux tâches ont le même nom : "
                                    + tache.getNom()
                    );
                }
            }
        }
    }

    public static void main(String[] args) {
        PlatCommande steakFrites = new PlatCommande(
                "plat_1",
                "Steak frites",
                List.of(
                        new Tache("cuisson_sauce", 60, List.of("commis", "four"), "cuisson"),
                        new Tache("cuisson_steak", 8, List.of("chef", "plaque"), "cuisson"),
                        new Tache("cuisson_frites", 6, List.of("commis", "friteuse"), "cuisson"),
                        new Tache("dressage", 2, List.of("chef", "poste_dressage"), "dressage")
                )
        );

        PlatCommande spaghetti = new PlatCommande(
                "plat_2",
                "Spaghetti",
                List.of(
                        new Tache("cuisson_pate", 12, List.of("commis1", "casserole"), "cuisson"),
                        new Tache("cuisson_sauce", 20, List.of("chef1", "plaque"), "cuisson"),
                        new Tache("dressage", 2, List.of("chef1", "poste_dressage"), "dressage")
                )
        );

        PlanningCommande planningCommande = optimiserCommande(
                List.of(steakFrites, spaghetti),
                10,
                2
        );

        System.out.println("Service de la commande à t = " + planningCommande.serviceTime);
        System.out.println();

        for (TachePlanifiee tache : planningCommande.tachesPlanifiees) {
            System.out.println(tache);
        }
    }
}