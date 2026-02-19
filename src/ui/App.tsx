import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { mantineTheme } from './theme/mantine';
import Index from "./pages/Index";

const App = () => (
  <MantineProvider theme={mantineTheme} defaultColorScheme="dark">
    <Notifications position="top-right" />
    <ModalsProvider>
      <Index />
    </ModalsProvider>
  </MantineProvider>
);

export default App;
