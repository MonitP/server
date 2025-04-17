import { NotificationType } from "../const/notification-type.enum";

export class CreateNotificationDto {
  serverCode: string;
  serverName: string;
  type: NotificationType;
  timestamp: Date;
}
