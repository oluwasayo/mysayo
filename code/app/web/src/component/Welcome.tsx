import {
  Button,
  Container,
  createTheme,
  MantineProvider,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { siteName } from '@shared/lib/site'
import { IconSparkles } from '@tabler/icons-react'
import { useState } from 'react'

const theme = createTheme({
  primaryColor: 'indigo',
})

export default function Welcome() {
  const [clicks, setClicks] = useState(0)

  return (
    <MantineProvider defaultColorScheme="auto" theme={theme}>
      <Container py="xl" size="sm">
        <Stack align="center" gap="lg">
          <IconSparkles aria-hidden size={48} stroke={1.5} />
          <Title order={1} ta="center">
            {siteName}
          </Title>
          <Text c="dimmed" maw={480} ta="center">
            Static personal site built with Astro, React, Mantine, and the React
            Compiler — deployed on Cloudflare Pages.
          </Text>
          <Button onClick={() => setClicks(count => count + 1)} type="button">
            React island clicks: {clicks}
          </Button>
        </Stack>
      </Container>
    </MantineProvider>
  )
}
