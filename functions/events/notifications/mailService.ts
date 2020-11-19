import * as fs from 'fs';
import { EmailType, NotificationInviteParent } from './common-code/nodejs/types/notifications';
import localeService from './localeService';

class MailService {
  constructor(private ses: any, private fromAddress: string, private imageDomain: string) {}

  private getEmailHtml(templateFileName: string, data: any) {
    const html = fs.readFileSync(templateFileName, 'utf8');
    const htmlWithData = Object.keys(data).reduce(
      (acc, key) => acc.replace(new RegExp(`{{ ${key} }}`, 'g'), data[key]),
      html,
    );
    return htmlWithData;
  }

  private async sendEmail(emailAddress: string, bodyHtml: string, subject: string) {
    const params = {
      Destination: { ToAddresses: [emailAddress] },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: bodyHtml,
          },
        },
        Subject: {
          Charset: 'UTF-8',
          Data: subject,
        },
      },
      Source: this.fromAddress,
    };

    await this.ses.sendEmail(params).promise();
  }

  async send(emailAddress: string, type: EmailType, detail: any, language: string) {
    const t = localeService.getFixedT(language);
    let bodyHtml = null;
    let subject = null;

    if (type === EmailType.InviteParent) {
      const templateFileName = './child-invitation.html';
      const inviteParent = detail as NotificationInviteParent;
      const fullName = `${inviteParent.childFirstName} ${inviteParent.childLastName}`;

      subject = t('email.inviteParentSubject', { fullName });
      bodyHtml = this.getEmailHtml(templateFileName, {
        domain: `https://${this.imageDomain}`,
        photo: inviteParent.childPhoto,
        url_invite: inviteParent.invitationUrl,
        text1: t('email.inviteParentLine1'),
        text2: t('email.inviteParentBirth'),
        text3: 'Email',
        text4: t('email.inviteParentLine2'),
        button: t('email.inviteParentButton'),
        fullName,
        birth: inviteParent.childBirthDate,
        email: inviteParent.childEmail,
      });
    }

    if (emailAddress && bodyHtml && subject) {
      await this.sendEmail(emailAddress, bodyHtml, subject);
    } else {
      console.error('Invalid send email data.');
    }
  }
}

export default MailService;
