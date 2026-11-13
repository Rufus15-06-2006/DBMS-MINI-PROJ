import './globals.css';

export const metadata = {
  title: 'Hospital Supply Chain Management',
  description: 'DBMS lab project: inventory, procurement, expiry monitoring and audit events.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
