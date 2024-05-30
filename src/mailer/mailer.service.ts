import {
  EmailAddress,
  EmailClient,
  EmailMessage,
} from '@azure/communication-email';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailerService {
  constructor(private readonly configService: ConfigService) {}

  async sendPasswordResetEmail(email: string, token: string) {
    const connectionString = this.configService.get('COMMUNICATION_STRING');

    const client = new EmailClient(connectionString);
    const senderAddress =
      'DoNotReply@4f303b4d-ce94-4c1c-bb69-1da2753a8221.azurecomm.net';

    const emailMessage = {
      senderAddress: senderAddress,
      content: {
        subject: 'Réinitialisation du mot de passe - CapitaLille',
        html: `
                <html>
                <head>
                    <style>
                        @font-face {
                            font-family: 'Lexend', sans-serif;
                            src: url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap');
                        }

                        body {
                            font-family: 'Lexend';
                            background-color: #f9f9f9;
                            margin: 0;
                            padding: 0;
                            line-height: 1.6;
                        }
                        .container {
                            max-width: 600px;
                            margin: 20px auto;
                            padding: 20px;
                            background-color: #ffffff;
                            border-radius: 10px;
                            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
                        }
                        .header {
                            text-align: center;
                            padding-bottom: 20px;
                            border-bottom: 1px solid #eeeeee;
                        }
                        .header h1 {
                            font-size: 24px;
                            color: #333333;
                            margin-top: 0;
                        }
                        .content {
                            padding: 20px;
                            color: #666666;
                        }
                        .footer {
                            text-align: center;
                            color: #999999;
                            font-size: 12px;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Réinitialisation du mot de passe</h1>
                        </div>
                        <div class="content">
                            <p>Bonjour,</p>
                            <p>Vous avez demandé à réinitialiser votre mot de passe pour votre compte CapitaLille. Veuillez cliquer sur le lien ci-dessous pour procéder à la réinitialisation :</p>
                            <p><a href="https://capitalille.azurewebsites.net/reset-password?token=${token}">Réinitialiser le mot de passe</a></p>
                            <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet e-mail.</p>
                            <p>Cordialement,<br>L'équipe CapitaLille</p>
                        </div>
                        <div class="footer">
                            <p>Cet e-mail a été envoyé automatiquement. Merci de ne pas y répondre.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
      },
      recipients: {
        to: [{ address: email }],
      },
    };

    try {
      const response = await client.beginSend(emailMessage);
      console.log(
        "E-mail envoyé avec l'identifiant de message :",
        response.toString(),
      );
    } catch (error) {
      console.log("Erreur lors de l'envoi de l'e-mail :", error);
    }
  }
}
