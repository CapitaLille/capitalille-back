export class CreateLobbyDto {
  owner: string;
  players: string[];
  map: string;
  turnSchedule: number;
  turnCount: number;
  turnCountMax: number;
  startTime: Date;
}
