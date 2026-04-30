import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { clearTokens } from "../lib/storage/auth-storage";
import { getCurrentUser } from "../features/auth/api";
import { erpBrand, erpColors } from "../theme/tokens";

type Props = {
  navigation: any;
};

export default function BootstrapScreen({ navigation }: Props) {
  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        await getCurrentUser();

        if (!mounted) return;
        navigation.replace("MainTabs");
      } catch {
        await clearTokens();

        if (!mounted) return;
        navigation.replace("Login");
      }
    }

    const timer = setTimeout(boot, 250);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [navigation]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: erpColors.navy2,
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
    >
      <Text style={{ color: erpColors.gold, fontWeight: "800", letterSpacing: 1.4 }}>
        {erpBrand.title}
      </Text>

      <Text
        style={{
          marginTop: 10,
          color: "#fff",
          fontWeight: "800",
          fontSize: 30
        }}
      >
        Mobile ERP
      </Text>

      <Text
        style={{
          marginTop: 12,
          color: "rgba(255,255,255,0.76)",
          textAlign: "center",
          lineHeight: 24
        }}
      >
        بوابة موبايل للإدارة والتنفيذ بنفس الصلاحيات الحالية ونفس الهوية البصرية.
      </Text>

      <ActivityIndicator color={erpColors.gold} style={{ marginTop: 24 }} />
    </View>
  );
}
