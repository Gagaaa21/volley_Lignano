import { createContext, useContext } from "react";
import type { AthleteContact } from "@/lib/trips/types";

/** Chi è un'atleta per la lavagna della trasferta: nome e numeri in rubrica. */
export interface BoardPerson {
  name: string;
  contacts: AthleteContact[];
}

/** Quello che la lavagna dei mezzi mette a disposizione di schede e posti (vedi TripBoard). */
export interface BoardApi {
  matchId: string;
  people: Record<string, BoardPerson>;
  /** Le convocate della partita. */
  calledUp: ReadonlySet<string>;
  /** Le convocate ancora senza passaggio, nell'ordine della convocazione. */
  unplaced: string[];
  driverNames: string[];
  ownerNames: string[];
  /** L'atleta che si sta trascinando, se c'è. */
  dragging: string | null;
  /** Mette un'atleta su un mezzo (anche spostandola da un altro) o, senza mezzo, la toglie dal suo. */
  move(athleteId: string, vehicleId: string | null): void;
  setSeats(vehicleId: string, seats: number): void;
  remove(vehicleId: string): void;
  startDrag(athleteId: string): void;
  endDrag(): void;
  nameOf(athleteId: string): string;
}

export const BoardContext = createContext<BoardApi | null>(null);

export function useBoard(): BoardApi {
  const api = useContext(BoardContext);
  if (!api) throw new Error("Questo componente va dentro TripBoard.");
  return api;
}
