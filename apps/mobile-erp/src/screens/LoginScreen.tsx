import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { mobileErpLogin } from "../features/auth/api";
import { erpColors } from "../theme/tokens";

type Props = {
  navigation: any;
};

export default function LoginScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const passwordRef = useRef<TextInput | null>(null);

  const canSubmit = Boolean(identifier.trim() && password.trim());

  const mutation = useMutation({
    mutationFn: mobileErpLogin,
    onSuccess: () => {
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }]
      });
    }
  });

  function submit() {
    if (!canSubmit || mutation.isPending) return;

    mutation.mutate({
      identifier: identifier.trim(),
      password: password.trim()
    });
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: erpColors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: erpColors.navy2,
              borderRadius: 28,
              padding: 22,
              marginBottom: 12
            }}
          >
            <Text style={{ color: erpColors.gold, fontWeight: "800", textAlign: "right" }}>
              ROYAL PALACE MOBILE ERP
            </Text>

            <Text
              style={{
                marginTop: 8,
                fontSize: 28,
                fontWeight: "800",
                color: "#fff",
                textAlign: "right"
              }}
            >
              تسجيل الدخول
            </Text>

            <Text
              style={{
                marginTop: 10,
                color: "rgba(255,255,255,0.78)",
                lineHeight: 24,
                textAlign: "right"
              }}
            >
              استخدم نفس بيانات الإدارة الحالية. هذا التطبيق يحترم نفس الأدوار والصلاحيات الحالية.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: erpColors.surface,
              borderRadius: 24,
              padding: 20,
              borderWidth: 1,
              borderColor: erpColors.border
            }}
          >
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="اسم المستخدم أو البريد أو الهاتف"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              textAlign="right"
              style={inputStyle}
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />

            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder="كلمة المرور"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              returnKeyType="done"
              textAlign="right"
              style={inputStyle}
              onSubmitEditing={submit}
            />

            {mutation.isError ? (
              <View
                style={{
                  marginTop: 12,
                  backgroundColor: erpColors.dangerBg,
                  borderWidth: 1,
                  borderColor: "#fecaca",
                  borderRadius: 16,
                  padding: 12
                }}
              >
                <Text style={{ color: erpColors.danger, fontWeight: "700", textAlign: "right" }}>
                  {mutation.error instanceof Error ? mutation.error.message : "تعذر تسجيل الدخول."}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={!canSubmit || mutation.isPending}
              style={[
                {
                  marginTop: 18,
                  backgroundColor: erpColors.navy2,
                  borderRadius: 999,
                  paddingVertical: 14,
                  alignItems: "center"
                },
                (!canSubmit || mutation.isPending) && { opacity: 0.6 }
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                {mutation.isPending ? "جاري تسجيل الدخول..." : "دخول"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const inputStyle = {
  marginTop: 12,
  backgroundColor: "#ffffff",
  borderWidth: 1,
  borderColor: "#cbd5e1",
  borderRadius: 18,
  paddingHorizontal: 14,
  paddingVertical: 14,
  textAlign: "right" as const,
  color: "#0f172a"
};
