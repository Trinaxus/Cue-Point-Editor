export interface CuePointData {
  id: string;
  time: number;
  name: string;
  artist?: string;
  title?: string;
  performer?: string;
  locked?: boolean;
  confirmed?: boolean;
}