import "./globals.css";
import { I18nProvider } from "./components/I18nProvider";

export const metadata = {
  title: "Royal Palace ERP Admin",
  description: "Royal Palace ERP Admin Portal",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
