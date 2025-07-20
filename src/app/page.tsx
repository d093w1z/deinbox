'use client';
import {Button} from '@mantine/core';
import {ThemeToggle} from '@/components/theme-toggle';
import {AppShell, Group, Burger, Skeleton} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';

export default function Home() {
  const user = null;
  const [opened, {toggle}] = useDisclosure();

  return (
    <div className='container mx-auto p-4'>
      <AppShell
        header={{height: 60}}
        navbar={{width: 300, breakpoint: 'sm', collapsed: {mobile: !opened}}}
        padding='md'
      >
        <AppShell.Header>
          <Group h='100%' w='100%' px='md'>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom='sm'
              size='sm'
            />
            <ThemeToggle />
          </Group>
        </AppShell.Header>
        <AppShell.Navbar p='md'>
          Navbar
          {Array(15)
            .fill(0)
            .map((_, index) => (
              <Skeleton key={index} h={28} mt='sm' animate={false} />
            ))}
        </AppShell.Navbar>
        <AppShell.Main>
          <Button variant='filled'>Continue with google</Button>
          Main
        </AppShell.Main>
      </AppShell>
    </div>
  );
}
