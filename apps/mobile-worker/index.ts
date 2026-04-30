import { I18nManager } from "react-native";
import { registerRootComponent } from "expo";

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
I18nManager.swapLeftAndRightInRTL(true);

import App from "./App";

registerRootComponent(App);
