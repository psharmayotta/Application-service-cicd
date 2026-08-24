import nodemailer from 'nodemailer';
import { BCC } from '../../config';

export interface EmailData {
  email: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: any;
  cc?: any;
  bcc?: any;
}

export class EmailService {
  static async sendEmail(data: EmailData) {
    return new Promise(async (resolve, reject) => {
      let transporter = nodemailer.createTransport({
        host: 'email-smtp.ap-south-1.amazonaws.com',
        port: 587,
        pool: true,
        tls: {
          rejectUnauthorized: false,
        },
        auth: {
          user: 'AKIAXWMXECHNFGT6UTWP',
          pass: 'BEakt81SgW2MZOhKYObSl/fXmwyzlekfTQYt/mwJcigc',
        },
        logger: false,
      });

      transporter.sendMail(
        {
          from:'contactus@asmadiya.com',
          to: data.email,
          cc: data.cc || [],
          bcc: BCC,
          subject: data.subject,
          text: data.text,
          html: data.html,
          headers: data.headers,
        },
        (err, info) => {
          if (err) return reject(err);
          resolve(info.response);
        }
      );
    });
  }
}
