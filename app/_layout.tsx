import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useContractionBootstrap } from '@/state/useContractionStore';
import { ThemeProvider, useTheme } from '@/ui/theme';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootShell />
    </ThemeProvider>
  );
}

function RootShell() {
  useContractionBootstrap();
  const { colors, scheme } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.systemBackground }}>
      <SafeAreaProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.systemBackground },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="timer" />
          <Stack.Screen name="history" />
          <Stack.Screen name="history/[id]" />
          <Stack.Screen name="settings" />
          <Stack.Screen
            name="share"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.5, 1.0],
              sheetGrabberVisible: true,
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="urgent"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [1.0],
              sheetGrabberVisible: true,
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
