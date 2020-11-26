import * as OneSignal from 'onesignal-node';
import {
  WebhookEvent,
  NotificationType,
  NotificationTeamInvitation,
  KycStatus,
  NotificationKycReview,
  NotificationInviteParent,
  NotificationChildInvitation,
  NotificationSendMoneyRequest,
} from './common-code/nodejs/types/notifications';
import localeService from './localeService';

const { ONESIGNAL_APP_ID = '', ONESIGNAL_API_KEY = '' } = process.env;
const oneSignal = new OneSignal.Client(ONESIGNAL_APP_ID, ONESIGNAL_API_KEY);

interface KeyAnyObject {
  [key: string]: any;
}

interface NotificationData {
  headings?: KeyAnyObject;
  contents?: KeyAnyObject;
  data?: KeyAnyObject;
  ios_attachments?: KeyAnyObject;
  large_icon?: string;
  big_picture?: string;
  ios_sound?: string;
  android_sound?: string;
  android_channel_id?: string;
}

class PushNotifications {
  constructor(private imageDomain: string) {}

  private getImageUrl(image: string = '') {
    return image ? `https://${this.imageDomain}/${image}` : '';
  }

  private notification(headings: string, contents: string, imageUrl?: string) {
    const data: NotificationData = {
      headings: {
        en: headings,
      },
      contents: {
        en: contents,
      },
      ios_sound: 'default',
      android_channel_id: '3410e243-de57-48eb-9898-c79b52b6ee3d',
    };

    if (imageUrl) {
      data.ios_attachments = { logo: imageUrl };
      data.large_icon = imageUrl;
      data.big_picture = imageUrl;
    }

    return data;
  }

  private getData(
    language: string,
    type: NotificationType | WebhookEvent,
    detail: any,
  ): NotificationData | null {
    const t = localeService.getFixedT(language);

    switch (type) {
      case NotificationType.AcceptTeamInvitation:
      case NotificationType.DeclineTeamInvitation:
        const isAccept = type === NotificationType.AcceptTeamInvitation;
        const teamInvitation = detail as NotificationTeamInvitation;
        const logoUrl = this.getImageUrl(teamInvitation.teamLogo);

        return this.notification(
          t('notification.teamRequest'),
          t(
            isAccept
              ? 'notification.acceptedTeamInvitation'
              : 'notification.declinedTeamInvitation',
            {
              teamName: teamInvitation.teamName,
            },
          ),
          logoUrl,
        );

      case NotificationType.KycReview:
        const kycReview = detail as NotificationKycReview;
        if (kycReview.status === KycStatus.VALIDATED || kycReview.status === KycStatus.REFUSED) {
          return this.notification(
            t('notification.verification'),
            t(
              kycReview.status === KycStatus.VALIDATED
                ? 'notification.verificationApproved'
                : 'notification.verificationRejected',
            ),
          );
        }

      case NotificationType.InviteParent:
        const inviteParent = detail as NotificationInviteParent;
        return this.notification(
          t('notification.familyRequest'),
          t('notification.familyRequestMessage', {
            name: `${inviteParent.childFirstName} ${inviteParent.childLastName}`,
          }),
          inviteParent.childPhoto,
        );

      case NotificationType.AcceptChildInvitation:
      case NotificationType.DeclineChildInvitation:
        const childAccepted = type === NotificationType.AcceptChildInvitation;
        const childInvitation = detail as NotificationChildInvitation;
        return this.notification(
          t('notification.familyRequest'),
          t(
            childAccepted
              ? 'notification.familyRequestAccepted'
              : 'notification.familyRequestRejected',
            {
              name: `${childInvitation.parentFirstName} ${childInvitation.parentLastName}`,
            },
          ),
        );

      case NotificationType.SendMoneyRequest:
        const sendMoneyRequest = detail as NotificationSendMoneyRequest;
        const senderName = `${sendMoneyRequest.senderFirstName} ${sendMoneyRequest.senderLastName}`;
        const sendAmount = Number(sendMoneyRequest.amount).toLocaleString('it', {
          style: 'currency',
          currency: 'EUR',
        });

        return this.notification(
          t('notification.moneyRequest'),
          t('notification.moneyRequestMessage', {
            name: senderName,
            amount: sendAmount,
            note: sendMoneyRequest.note,
          }),
        );

      case NotificationType.CardLockChanged:
        return this.notification(
          t('notification.cardLockChanged'),
          t(
            detail.statusCode === 'LOCK'
              ? 'notification.cardLockekMessage'
              : 'notification.cardUnlockedMessage',
            { cardNumber: detail.maskedPan },
          ),
        );

      case NotificationType.CardLimitChanged:
        return this.notification(
          t('notification.cardLimitChanged'),
          t('notification.cardLimitChangedMessage', { cardNumber: detail.maskedPan }),
        );

      default:
        return null;
    }
  }

  async send(
    language: string,
    deviceIds: string[],
    notificationType: NotificationType | WebhookEvent,
    detail: any,
  ) {
    const data = this.getData(language, notificationType, detail);

    if (!data || !deviceIds || !deviceIds.length) {
      return;
    }

    const notification = { ...data, include_player_ids: deviceIds };

    try {
      const res = await oneSignal.createNotification(notification);
    } catch (err) {
      console.error({
        err,
        deviceIds,
      });
    }
  }
}

export default PushNotifications;
