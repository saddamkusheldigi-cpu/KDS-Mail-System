import "./globals.css";

export const metadata = {
  title: "InboxMailer | AWS Serverless Bulk Mailer",
  description: "High-deliverability serverless email dispatch system on AWS SES, SQS and Lambda",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
