import * as OneSignal from 'onesignal-node';
import {
  WebhookEvent,
  NotificationType,
  NotificationTeamInvitation,
  KycStatus,
  CardStatus,
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
  private cardStatusKeys: Map<string, string>;
  private childKycStatusKeys: Map<string, string>;

  constructor(private imageDomain: string) {
    this.cardStatusKeys = new Map([
      [CardStatus.LOCK, 'notification.cardLockekMessage'],
      [CardStatus.UNLOCK, 'notification.cardUnlockedMessage'],
      [CardStatus.LOST, 'notification.cardLostMessage'],
      [CardStatus.STOLEN, 'notification.cardStolenMessage'],
    ]);

    this.childKycStatusKeys = new Map([
      [KycStatus.PENDING, 'childVerificationPending'],
      [KycStatus.VALIDATED, 'childVerificationApproved'],
      [KycStatus.REFUSED, 'childVerificationRejected'],
    ]);
  }

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

  private formatMoney(amount: string | number) {
    return Number(amount).toLocaleString('it', {
      style: 'currency',
      currency: 'EUR',
    });
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

      case NotificationType.AcceptTeamInvitationToParent:
      case NotificationType.DeclineTeamInvitationToParent:
        return this.notification(
          t('notification.teamRequest'),
          t(
            type === NotificationType.AcceptTeamInvitationToParent
              ? 'notification.acceptedTeamInvitationToParent'
              : 'notification.declinedTeamInvitationToParent',
            {
              teamName: detail.teamName,
              childName: detail.childName,
            },
          ),
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

      case NotificationType.ChildKycReview:
        return this.notification(
          t('notification.childVerification'),
          t(this.childKycStatusKeys.get(detail.status), {
            childName: `${detail.childFirstName} ${detail.childLastName}`,
          }),
        );

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
        const sendAmount = this.formatMoney(sendMoneyRequest.amount);

        return this.notification(
          t('notification.moneyRequest'),
          t('notification.moneyRequestMessage', {
            name: senderName,
            amount: sendAmount,
            note: sendMoneyRequest.note ? `. ${sendMoneyRequest.note}` : '',
          }),
        );

      case NotificationType.RejectMoneyRequest:
        return this.notification(
          t('notification.moneySent'),
          t('notification.moneyRequestRejected', {
            name: `${detail.name}`,
            amount: this.formatMoney(detail.amount),
          }),
        );

      case NotificationType.ApproveMoneyRequest:
        return this.notification(
          t('notification.moneySent'),
          t('notification.moneyRequestApproved', {
            name: `${detail.name}`,
            amount: this.formatMoney(detail.amount),
          }),
        );

      case NotificationType.SendMoney:
        return this.notification(
          t('notification.moneySent'),
          t('notification.sendMoney', {
            name: `${detail.recipientFirstName} ${detail.recipientLastName}`,
            amount: this.formatMoney(detail.amount),
          }),
        );

      case NotificationType.ChildSendMoneyRequest:
        const moneyRequestParent = detail as NotificationSendMoneyRequest;
        return this.notification(
          t('notification.moneyRequest'),
          t('notification.moneyRequestParent', {
            childName: `${moneyRequestParent.senderFirstName} ${moneyRequestParent.senderLastName}`,
            name: `${moneyRequestParent.recipientFirstName} ${moneyRequestParent.recipientLastName}`,
            amount: this.formatMoney(moneyRequestParent.amount),
          }),
        );

      case NotificationType.ChildSendMoney:
        return this.notification(
          t('notification.moneySent'),
          t('notification.sendMoneyParent', {
            childName: `${detail.senderFirstName} ${detail.senderLastName}`,
            name: `${detail.recipientFirstName} ${detail.recipientLastName}`,
            amount: this.formatMoney(detail.amount),
          }),
        );

      case NotificationType.ReceivedMoney:
        return this.notification(
          t('notification.moneySent'),
          t('notification.receivedMoneyFrom', {
            name: `${detail.senderFirstName} ${detail.senderLastName}`,
            amount: this.formatMoney(detail.amount),
          }),
        );

      case NotificationType.ChildReceivedMoney:
        return this.notification(
          t('notification.childReceivedMoney'),
          t('notification.childReceivedMoneyParent', {
            name: `${detail.senderFirstName} ${detail.senderLastName}`,
            childName: `${detail.recipientFirstName} ${detail.recipientLastName}`,
            amount: this.formatMoney(detail.amount),
          }),
        );

      case NotificationType.CardLockChanged:
        return this.notification(
          t('notification.cardLockChanged'),
          t(this.cardStatusKeys.get(detail.statusCode), { cardNumber: detail.maskedPan }),
        );

      case NotificationType.CardLimitChanged:
        return this.notification(
          t('notification.cardLimitChanged'),
          t('notification.cardLimitChangedMessage', { cardNumber: detail.maskedPan }),
        );

      case NotificationType.ChildSendTeamInvitation:
        return this.notification(
          t('notification.teamRequest'),
          t('notification.childSendTeamInvitationMessage', {
            childName: detail.childFirstName,
            teamName: detail.teamName,
          }),
        );

      case NotificationType.ApproveTeamInvitationByParent:
        return this.notification(
          t('notification.teamRequest'),
          t('notification.approvedTeamInvitationByParent', {
            parentName: detail.parentFirstName,
            teamName: detail.teamName,
          }),
        );

      case NotificationType.RejectTeamInvitationByParent:
        return this.notification(
          t('notification.teamRequest'),
          t('notification.rejectTeamInvitationByParent', {
            parentName: detail.parentFirstName,
            teamName: detail.teamName,
          }),
        );

      case NotificationType.AcceptedPaidEvent:
        const eventPrice = Number(detail.eventPrice).toLocaleString('it', {
          style: 'currency',
          currency: 'EUR',
        });

        return this.notification(
          t('notification.paidEventToParentTitle'),
          t('notification.paidEventToParent', {
            childName: detail.childFirstName,
            eventTitle: detail.eventTitle,
            eventPrice: eventPrice,
          }),
        );

      case NotificationType.PaidQrPayment:
        return this.notification(
          t('notification.qrPayment'),
          t('notification.paidQrPayment', {
            name: `${detail.firstName} ${detail.lastName}`,
            description: detail.description,
            amount: Number(detail.amount).toLocaleString('it', {
              style: 'currency',
              currency: 'EUR',
            }),
          }),
        );

      case NotificationType.YouPaidQrPayment:
        return this.notification(
          t('notification.qrPayment'),
          t('notification.youPaidQrPayment', {
            amount: Number(detail.amount).toLocaleString('it', {
              style: 'currency',
              currency: 'EUR',
            }),
          }),
        );

      default:
        return null;
    }
  }

  // TODO: language -> enum
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
      console.log('Sent push notification', notification);
    } catch (err) {
      console.error({
        err,
        deviceIds,
      });
    }
  }
}

export default PushNotifications;
