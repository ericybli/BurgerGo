import { Pressable, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { Settings as SettingsIcon } from 'lucide-react-native';
import type { RootStackParamList } from './navigation/types';
import { TripScreen } from './navigation/TripTabs';
import { HomeScreen } from './screens/home/HomeScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { colors, font } from './lib/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });
  // Cream splash field while fonts load (Atlas splash recipe).
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.cream }} />;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerTintColor: colors.ink,
            headerTitleStyle: { fontFamily: font.bold, fontSize: 17 },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={({ navigation }) => ({
              title: 'BurgerGo',
              headerRight: () => (
                <Pressable
                  onPress={() => navigation.navigate('Settings')}
                  hitSlop={10}
                  accessibilityLabel="Settings"
                  style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
                >
                  <SettingsIcon size={20} color={colors.ink} />
                </Pressable>
              ),
            })}
          />
          <Stack.Screen
            name="Trip"
            component={TripScreen}
            options={({ route }) => ({ title: route.params.name })}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
