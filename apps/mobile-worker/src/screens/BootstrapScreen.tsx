import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { getCurrentWorker } from "../features/auth/api";
import { clearTokens } from "../lib/storage/auth-storage";

type Props = { navigation: any };

export default function BootstrapScreen({ navigation }: Props) {
  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      try {
        await getCurrentWorker();
        if (!mounted) return;
        navigation.replace("MainTabs");
      } catch {
        await clearTokens();
        if (!mounted) return;
        navigation.replace("WorkerLogin");
      }
    }
    const timer = setTimeout(() => { bootstrap(); }, 250);
    return () => { mounted = false; clearTimeout(timer); };
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0b1f3a", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ color: "#d4af37", fontWeight: "700", letterSpacing: 1, textAlign: "right", writingDirection: "rtl" }}>ROYAL PALACE</Text>
      <Text style={{ marginTop: 10, fontSize: 32, fontWeight: "800", color: "#fff", textAlign: "right", writingDirection: "rtl" }}>تطبيق العامل</Text>
      <Text style={{ marginTop: 12, color: "#cbd5e1", textAlign: "right", lineHeight: 24, writingDirection: "rtl" }}>بوابتك المخصصة للحضور والانصراف وأوامر التشغيل وشؤون الموظف داخل المصنع.</Text>
      <ActivityIndicator style={{ marginTop: 24 }} color="#d4af37" />
    </View>
  );
}
