import "react-native-gesture-handler";
import { I18nManager, Text, View } from "react-native";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import BootstrapScreen from "./src/screens/BootstrapScreen";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ModulesScreen from "./src/screens/ModulesScreen";
import ModuleViewerScreen from "./src/screens/ModuleViewerScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import DashboardModuleScreen from "./src/screens/DashboardModuleScreen";
import UsersModuleScreen from "./src/screens/UsersModuleScreen";
import RolesModuleScreen from "./src/screens/RolesModuleScreen";
import FactoriesModuleScreen from "./src/screens/FactoriesModuleScreen";
import DepartmentsModuleScreen from "./src/screens/DepartmentsModuleScreen";
import EmployeesModuleScreen from "./src/screens/EmployeesModuleScreen";
import AttendanceModuleScreen from "./src/screens/AttendanceModuleScreen";
import OrdersModuleScreen from "./src/screens/OrdersModuleScreen";
import WorkOrdersModuleScreen from "./src/screens/WorkOrdersModuleScreen";
import WarehousesModuleScreen from "./src/screens/WarehousesModuleScreen";
import InventoryModuleScreen from "./src/screens/InventoryModuleScreen";
import CategoriesModuleScreen from "./src/screens/CategoriesModuleScreen";
import ProductsModuleScreen from "./src/screens/ProductsModuleScreen";
import B2BModuleScreen from "./src/screens/B2BModuleScreen";
import ItModuleScreen from "./src/screens/ItModuleScreen";
import InfrastructureModuleScreen from "./src/screens/InfrastructureModuleScreen";
import DeploymentsModuleScreen from "./src/screens/DeploymentsModuleScreen";
import BackupsModuleScreen from "./src/screens/BackupsModuleScreen";
import LogsViewerModuleScreen from "./src/screens/LogsViewerModuleScreen";
import MediaModuleScreen from "./src/screens/MediaModuleScreen";
import ThemesModuleScreen from "./src/screens/ThemesModuleScreen";
import BrandingModuleScreen from "./src/screens/BrandingModuleScreen";
import PagesStudioModuleScreen from "./src/screens/PagesStudioModuleScreen";
import UISettingsModuleScreen from "./src/screens/UISettingsModuleScreen";
import GlobalSettingsModuleScreen from "./src/screens/GlobalSettingsModuleScreen";
import { erpBrand, erpColors } from "./src/theme/tokens";

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const queryClient = new QueryClient();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: erpColors.bg,
    card: erpColors.navy2,
    text: "#ffffff",
    border: "rgba(212,175,55,0.18)",
    primary: erpColors.gold
  }
};

function HeaderBrandTitle() {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff" }}>{erpBrand.title}</Text>
      <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.76)", letterSpacing: 1 }}>
        {erpBrand.subtitle}
      </Text>
    </View>
  );
}

function baseStackOptions(title?: string) {
  return {
    title,
    headerTitle: () => <HeaderBrandTitle />,
    headerTitleAlign: "center" as const,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: erpColors.navy2 },
    headerTintColor: erpColors.gold,
    headerBackTitleVisible: false,
    contentStyle: { backgroundColor: erpColors.bg, direction: "rtl" as const },
    animation: I18nManager.isRTL ? ("slide_from_right" as const) : ("slide_from_left" as const)
  };
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={baseStackOptions()}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={baseStackOptions("الرئيسية")} />
    </Stack.Navigator>
  );
}

function ModulesStack() {
  return (
    <Stack.Navigator screenOptions={baseStackOptions()}>
      <Stack.Screen name="ModulesMain" component={ModulesScreen} options={baseStackOptions("الوحدات")} />
      <Stack.Screen name="DashboardModule" component={DashboardModuleScreen} options={baseStackOptions("لوحة التحكم")} />
      <Stack.Screen name="UsersModule" component={UsersModuleScreen} options={baseStackOptions("المستخدمون")} />
      <Stack.Screen name="RolesModule" component={RolesModuleScreen} options={baseStackOptions("الأدوار والصلاحيات")} />
      <Stack.Screen name="FactoriesModule" component={FactoriesModuleScreen} options={baseStackOptions("المصانع")} />
      <Stack.Screen name="DepartmentsModule" component={DepartmentsModuleScreen} options={baseStackOptions("الأقسام")} />
      <Stack.Screen name="EmployeesModule" component={EmployeesModuleScreen} options={baseStackOptions("الموظفون")} />
      <Stack.Screen name="AttendanceModule" component={AttendanceModuleScreen} options={baseStackOptions("الحضور والانصراف")} />
      <Stack.Screen name="OrdersModule" component={OrdersModuleScreen} options={baseStackOptions("الطلبات")} />
      <Stack.Screen name="WorkOrdersModule" component={WorkOrdersModuleScreen} options={baseStackOptions("أوامر التشغيل")} />
      <Stack.Screen name="WarehousesModule" component={WarehousesModuleScreen} options={baseStackOptions("المخازن")} />
      <Stack.Screen name="InventoryModule" component={InventoryModuleScreen} options={baseStackOptions("المخزون")} />
      <Stack.Screen name="CategoriesModule" component={CategoriesModuleScreen} options={baseStackOptions("التصنيفات")} />
      <Stack.Screen name="ProductsModule" component={ProductsModuleScreen} options={baseStackOptions("المنتجات")} />
      <Stack.Screen name="B2BModule" component={B2BModuleScreen} options={baseStackOptions("حسابات B2B")} />
      <Stack.Screen name="ItModule" component={ItModuleScreen} options={baseStackOptions("تقنية المعلومات")} />
      <Stack.Screen name="InfrastructureModule" component={InfrastructureModuleScreen} options={baseStackOptions("البنية التحتية")} />
      <Stack.Screen name="DeploymentsModule" component={DeploymentsModuleScreen} options={baseStackOptions("النشرات")} />
      <Stack.Screen name="BackupsModule" component={BackupsModuleScreen} options={baseStackOptions("النسخ الاحتياطية")} />
      <Stack.Screen name="LogsViewerModule" component={LogsViewerModuleScreen} options={baseStackOptions("عارض السجلات")} />
      <Stack.Screen name="MediaModule" component={MediaModuleScreen} options={baseStackOptions("الوسائط")} />
      <Stack.Screen name="ThemesModule" component={ThemesModuleScreen} options={baseStackOptions("الثيمات")} />
      <Stack.Screen name="BrandingModule" component={BrandingModuleScreen} options={baseStackOptions("الهوية البصرية")} />
      <Stack.Screen name="PagesStudioModule" component={PagesStudioModuleScreen} options={baseStackOptions("استوديو الصفحات")} />
      <Stack.Screen name="UISettingsModule" component={UISettingsModuleScreen} options={baseStackOptions("إعدادات الواجهة")} />
      <Stack.Screen name="GlobalSettingsModule" component={GlobalSettingsModuleScreen} options={baseStackOptions("الإعدادات العامة")} />
      <Stack.Screen name="ModuleViewer" component={ModuleViewerScreen} options={baseStackOptions("الوحدة")} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={baseStackOptions()}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={baseStackOptions("ملفي")} />
    </Stack.Navigator>
  );
}

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? erpColors.gold : "rgba(255,255,255,0.76)";
  return (
    <View
      style={{
        width: 42,
        height: 42,
        borderRadius: 999,
        backgroundColor: focused ? "rgba(212,175,55,0.14)" : "transparent",
        borderWidth: focused ? 1 : 0,
        borderColor: focused ? "rgba(212,175,55,0.24)" : "transparent",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Ionicons name={name as any} size={21} color={color} />
    </View>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: erpColors.bg, direction: "rtl" as const },
        tabBarStyle: {
          height: 70 + Math.max(insets.bottom, 8),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: "rgba(212,175,55,0.18)",
          backgroundColor: erpColors.navy2,
          direction: "rtl" as const
        },
        tabBarActiveTintColor: erpColors.gold,
        tabBarInactiveTintColor: "rgba(255,255,255,0.76)",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800" as const }
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ tabBarLabel: "الرئيسية", tabBarIcon: ({ focused }) => <TabIcon name="home-outline" focused={focused} /> }}
      />
      <Tab.Screen
        name="ModulesTab"
        component={ModulesStack}
        options={{ tabBarLabel: "الوحدات", tabBarIcon: ({ focused }) => <TabIcon name="grid-outline" focused={focused} /> }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{ tabBarLabel: "ملفي", tabBarIcon: ({ focused }) => <TabIcon name="person-outline" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer theme={navTheme}>
          <RootStack.Navigator initialRouteName="Bootstrap">
            <RootStack.Screen name="Bootstrap" component={BootstrapScreen} options={{ headerShown: false }} />
            <RootStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          </RootStack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
