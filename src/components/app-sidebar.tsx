'use client';

import * as React from 'react';
import {
    BookOpen,
    FolderSync,
    Frame,
    Inbox,
    LayoutDashboardIcon,
    LucideBrushCleaning,
    Mail,
    Map,
    PieChart,
    Settings2,
} from 'lucide-react';

import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenuButton,
    SidebarRail,
} from '@/components/ui/sidebar';
import { useSession } from 'next-auth/react';
import { Logo } from './logo';

// This is sample data.
const data = {
    teams: [
        {
            name: 'Deinbox',
            logo: Logo,
            plan: 'Enterprise',
        },
    ],
    navMain: [
        {
            title: 'Sync Status',
            url: '/sync-status',
            icon: FolderSync,
            isActive: true,
        },
        {
            title: 'Dashboard',
            url: '/dashboard',
            icon: LayoutDashboardIcon,
            isActive: true,
        },
        {
            title: 'Emails',
            url: '/emails',
            icon: Inbox,
            isActive: true,
        },
        {
            title: 'Clean Inbox',
            url: '#',
            icon: LucideBrushCleaning,
            isActive: true,
            items: [
                {
                    title: 'Suggestions',
                    url: '/suggestions',
                },
                {
                    title: 'Sender Groups',
                    url: '/sender-groups',
                },
                {
                    title: 'Category Groups',
                    url: '/category-groups',
                },
            ],
        },
        {
            title: 'Unsubscribe',
            url: '/unsubscribe',
            icon: Mail,
        },
        {
            title: 'Settings',
            url: '/settings',
            icon: Settings2,
        },
    ],
    projects: [
        {
            name: 'Design Engineering',
            url: '#',
            icon: Frame,
        },
        {
            name: 'Sales & Marketing',
            url: '#',
            icon: PieChart,
        },
        {
            name: 'Travel',
            url: '#',
            icon: Map,
        },
    ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { data: session, status } = useSession();
    const [avatarUrl, setAvatarUrl] = React.useState<string>('');

    React.useEffect(() => {
        if (status === 'authenticated' && !session.user?.image) {
            fetch('/api/user/avatar')
                .then((res) => res.json())
                .then((data) => {
                    if (data.image) {
                        setAvatarUrl(data.image);
                    }
                })
                .catch(() => {});
        }
    }, [status, session]);

    const user = React.useMemo(() => {
        if (status !== 'authenticated') {
            return { name: '', email: '', avatar: '' };
        }
        return {
            name: session.user?.name || 'User',
            email: session.user?.email || '',
            avatar: session.user?.image || avatarUrl,
        };
    }, [status, session, avatarUrl]);
    const [activeTeam] = React.useState(data.teams[0]);
    return (
        <Sidebar collapsible='icon' {...props}>
            <SidebarHeader>
                {/* <TeamSwitcher teams={data.teams} /> */}
                <SidebarMenuButton
                    size='lg'
                    className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
                >
                    <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
                        <activeTeam.logo className='size-auto' />
                    </div>
                    <div className='grid flex-1 text-left text-sm leading-tight'>
                        <span className='truncate font-medium'>
                            {activeTeam.name}
                        </span>
                        <span className='truncate text-xs'>
                            {activeTeam.plan}
                        </span>
                    </div>
                </SidebarMenuButton>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={user} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
