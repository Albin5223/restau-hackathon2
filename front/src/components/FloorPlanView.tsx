"use client";

import { useMemo } from "react";
import type { BackendGanttTask, BackendTable, ResourceTypeDto } from "@/lib/types";
import {
  buildKitchenStations,
  computeFloorHeight,
  FLOOR_WIDTH,
  getTablePosition,
  KITCHEN_AREA,
  STEP_KIND_FILL,
  TABLE_RADIUS,
  TABLE_STATUS_FILL,
  TABLE_STATUS_STROKE,
  type KitchenStation,
} from "@/lib/floorPlan";

type Props = {
  tables: BackendTable[];
  ganttTasks: BackendGanttTask[];
  resourceTypes: ResourceTypeDto[];
  now: number;
  selectedTableId: number | null;
  onSelectTable?: (id: number) => void;
  onAddTable?: () => void;
  isAddingTable?: boolean;
};

type ActiveStation = {
  station: KitchenStation;
  task: BackendGanttTask;
};

export function FloorPlanView({
  tables,
  ganttTasks,
  resourceTypes,
  now,
  selectedTableId,
  onSelectTable,
  onAddTable,
  isAddingTable,
}: Props) {
  const { firstEmptyNumber, floorHeight } = useMemo(() => {
    const occupied = new Set(tables.map((t) => t.number));
    let first = 1;
    while (occupied.has(first)) first++;
    const maxNumber = tables.length > 0 ? Math.max(...tables.map((t) => t.number)) : 0;
    const highestSlot = Math.max(maxNumber, first);
    return { firstEmptyNumber: first, floorHeight: computeFloorHeight(highestSlot) };
  }, [tables]);
  const addBtnPos = getTablePosition(firstEmptyNumber);
  const kitchenStations = useMemo(
    () => buildKitchenStations(resourceTypes),
    [resourceTypes],
  );

  const activeStationByStation = useMemo<Map<string, ActiveStation>>(() => {
    const m = new Map<string, ActiveStation>();
    for (const task of ganttTasks) {
      if (task.startAt > now || task.endAt < now) continue;
      for (const resourceName of task.resourceNames) {
        for (const station of kitchenStations) {
          if (station.resourceMatch(resourceName) && !m.has(station.id)) {
            m.set(station.id, { station, task });
          }
        }
      }
    }
    return m;
  }, [ganttTasks, now, kitchenStations]);

  const commandeWindowByTable = useMemo(() => {
    const m = new Map<number, { startAt: number; endAt: number }>();
    for (const task of ganttTasks) {
      const cur = m.get(task.tableNumber);
      if (!cur) {
        m.set(task.tableNumber, { startAt: task.startAt, endAt: task.endAt });
      } else {
        m.set(task.tableNumber, {
          startAt: Math.min(cur.startAt, task.startAt),
          endAt: Math.max(cur.endAt, task.endAt),
        });
      }
    }
    return m;
  }, [ganttTasks]);

  return (
    <svg
      viewBox={`0 0 ${FLOOR_WIDTH} ${floorHeight}`}
      className="h-auto w-full select-none"
      role="img"
      aria-label="Plan de la salle"
    >
      <rect
        x={0}
        y={0}
        width={FLOOR_WIDTH}
        height={floorHeight}
        rx={20}
        className="fill-zinc-50 stroke-zinc-200 dark:fill-zinc-900 dark:stroke-zinc-800"
        strokeWidth={2}
      />

      <rect
        x={KITCHEN_AREA.x}
        y={KITCHEN_AREA.y}
        width={KITCHEN_AREA.width}
        height={KITCHEN_AREA.height}
        rx={14}
        className="fill-zinc-100 stroke-zinc-300 dark:fill-zinc-950 dark:stroke-zinc-700"
        strokeWidth={2}
      />
      <text
        x={KITCHEN_AREA.x + 16}
        y={KITCHEN_AREA.y + 22}
        className="fill-zinc-500 dark:fill-zinc-400"
        fontSize={13}
        fontWeight={600}
        letterSpacing={2}
      >
        CUISINE
      </text>

      {kitchenStations.length === 0 && (
        <text
          x={KITCHEN_AREA.x + KITCHEN_AREA.width / 2}
          y={KITCHEN_AREA.y + KITCHEN_AREA.height / 2 + 4}
          textAnchor="middle"
          fontSize={13}
          className="fill-zinc-400 dark:fill-zinc-600"
        >
          Aucune ressource — configurez-en depuis la page Ressources
        </text>
      )}
      {kitchenStations.map((station) => {
        const active = activeStationByStation.get(station.id);
        const fill = active ? STEP_KIND_FILL[active.task.kind] : "#e4e4e7";
        const stroke = active ? "#18181b" : "#a1a1aa";
        return (
          <g key={station.id}>
            <rect
              x={station.x}
              y={station.y}
              width={station.width}
              height={station.height}
              rx={10}
              fill={fill}
              stroke={stroke}
              strokeWidth={active ? 2.5 : 1.5}
              style={
                active
                  ? { animation: "stationPulse 1.4s ease-in-out infinite" }
                  : undefined
              }
            />
            <text
              x={station.x + station.width / 2}
              y={station.y + station.height / 2 - 4}
              textAnchor="middle"
              fontSize={14}
              fontWeight={700}
              className="fill-zinc-900"
            >
              {station.label}
            </text>
            {active ? (
              <text
                x={station.x + station.width / 2}
                y={station.y + station.height / 2 + 16}
                textAnchor="middle"
                fontSize={11}
                fontWeight={500}
                className="fill-zinc-800"
              >
                T{active.task.tableNumber} · {active.task.dishName}
              </text>
            ) : (
              <text
                x={station.x + station.width / 2}
                y={station.y + station.height / 2 + 16}
                textAnchor="middle"
                fontSize={11}
                className="fill-zinc-500"
              >
                inactif
              </text>
            )}
          </g>
        );
      })}

      {tables.map((table) => {
        const pos = getTablePosition(table.number);
        const isSelected = table.id === selectedTableId;
        const fill = TABLE_STATUS_FILL[table.status];
        const stroke = isSelected ? "#18181b" : TABLE_STATUS_STROKE[table.status];

        const window = commandeWindowByTable.get(table.number);
        const showProgress =
          window && window.endAt > window.startAt && now >= window.startAt;
        const progress = showProgress
          ? Math.max(0, Math.min(1, (now - window.startAt) / (window.endAt - window.startAt)))
          : 0;

        const progressR = TABLE_RADIUS + 8;
        const circumference = 2 * Math.PI * progressR;

        return (
          <g
            key={table.id}
            onClick={() => onSelectTable?.(table.id)}
            style={{ cursor: onSelectTable ? "pointer" : "default" }}
          >
            {showProgress ? (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={progressR}
                fill="none"
                stroke="#18181b"
                strokeOpacity={0.15}
                strokeWidth={3}
              />
            ) : null}
            {showProgress ? (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={progressR}
                fill="none"
                stroke="#ef4444"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${progress * circumference} ${circumference}`}
                transform={`rotate(-90 ${pos.x} ${pos.y})`}
              />
            ) : null}

            <circle
              cx={pos.x}
              cy={pos.y}
              r={TABLE_RADIUS}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected ? 4 : 2}
            />
            <text
              x={pos.x}
              y={pos.y - 2}
              textAnchor="middle"
              fontSize={18}
              fontWeight={700}
              className="fill-zinc-900"
            >
              T{table.number}
            </text>
            <text
              x={pos.x}
              y={pos.y + 14}
              textAnchor="middle"
              fontSize={10}
              className="fill-zinc-700"
            >
              {table.seats} pl.
            </text>

            {table.partySize ? (
              <g>
                <circle
                  cx={pos.x + TABLE_RADIUS - 6}
                  cy={pos.y - TABLE_RADIUS + 6}
                  r={11}
                  fill="#18181b"
                />
                <text
                  x={pos.x + TABLE_RADIUS - 6}
                  y={pos.y - TABLE_RADIUS + 10}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#ffffff"
                >
                  {table.partySize}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {onAddTable && (
        <g
          onClick={onAddTable}
          style={{ cursor: "pointer" }}
          aria-label="Ajouter une table"
        >
          <circle
            cx={addBtnPos.x}
            cy={addBtnPos.y}
            r={TABLE_RADIUS}
            fill={isAddingTable ? "#18181b" : "#f4f4f5"}
            stroke={isAddingTable ? "#18181b" : "#a1a1aa"}
            strokeWidth={isAddingTable ? 3 : 2}
            strokeDasharray="6 4"
          />
          <text
            x={addBtnPos.x}
            y={addBtnPos.y + 7}
            textAnchor="middle"
            fontSize={28}
            fontWeight={300}
            fill={isAddingTable ? "#ffffff" : "#71717a"}
          >
            +
          </text>
        </g>
      )}

      <style>{`
        @keyframes stationPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </svg>
  );
}
