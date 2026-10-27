export type MailMessage = { to: string; subject: string; text: string };

/** Sends transactional email. Unlike push, a failure is reported to the caller. */
export type MailService = {
  send(message: MailMessage): Promise<void>;
};

const duration = (minutes: number) =>
  minutes >= 120 ? `${minutes / 60 / 24} days` : `${minutes} minutes`;

/** Every email FieldMate sends. Plain text: it reads the same in every mail app. */
export const mailMessages = {
  invite: (to: string, name: string, code: string, validMinutes: number): MailMessage => ({
    to,
    subject: 'You have been invited to FieldMate',
    text: [
      `Hi ${name},`,
      '',
      'You have been invited to FieldMate.',
      '',
      `Your code: ${code}`,
      '',
      'Open the FieldMate app, tap "Set up your account" on the sign-in screen, and enter',
      `this email address, the code and a password of your choice. The code works for ${duration(validMinutes)}.`,
    ].join('\n'),
  }),

  passwordReset: (to: string, name: string, code: string, validMinutes: number): MailMessage => ({
    to,
    subject: 'Your FieldMate password reset code',
    text: [
      `Hi ${name},`,
      '',
      `Your code to reset your FieldMate password: ${code}`,
      '',
      `It works for ${duration(validMinutes)}. If you did not ask for this, ignore this email;`,
      'your password stays the same.',
    ].join('\n'),
  }),

  emailChange: (to: string, name: string, code: string, validMinutes: number): MailMessage => ({
    to,
    subject: 'Confirm your new FieldMate email',
    text: [
      `Hi ${name},`,
      '',
      `Your code to confirm this address for FieldMate: ${code}`,
      '',
      `Enter it in the app within ${duration(validMinutes)}. If you did not ask for this, ignore this email.`,
    ].join('\n'),
  }),
};
