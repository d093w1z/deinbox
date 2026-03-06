'use client';

import { ChevronRight, type LucideIcon } from 'lucide-react';

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from '@/components/ui/sidebar';

export function NavMain({
    items,
}: {
    items: {
        title: string;
        url: string;
        icon?: LucideIcon;
        isActive?: boolean;
        items?: {
            title: string;
            url: string;
        }[];
    }[];
}) {
    const { state, isMobile } = useSidebar();
    const collapsedRail = state === 'collapsed' && !isMobile;

    return (
        <SidebarGroup>
            <SidebarGroupLabel></SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) =>
                    !item.items ? (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild tooltip={item.title}>
                                <a href={item.url}>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </a>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ) : collapsedRail ? (
                        // The sidebar is an icon-only rail, so there's no
                        // room to show indented sub-items inline (and the
                        // inline Collapsible below is hidden by the
                        // sidebar's own CSS in this state, making the
                        // group's items unreachable). Use a flyout menu
                        // instead.
                        <SidebarMenuItem key={item.title}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton tooltip={item.title}>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </SidebarMenuButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    side='right'
                                    align='start'
                                    className='min-w-48'
                                >
                                    <DropdownMenuLabel>
                                        {item.title}
                                    </DropdownMenuLabel>
                                    {item.items.map((subItem) => (
                                        <DropdownMenuItem
                                            key={subItem.title}
                                            asChild
                                        >
                                            <a href={subItem.url}>
                                                {subItem.title}
                                            </a>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    ) : (
                        <Collapsible
                            key={item.title}
                            asChild
                            defaultOpen={item.isActive}
                            className='group/collapsible'
                        >
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton tooltip={item.title}>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                        {item.items && (
                                            <ChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                                        )}
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {item.items
                                            ? item.items?.map((subItem) => (
                                                  <SidebarMenuSubItem
                                                      key={subItem.title}
                                                  >
                                                      <SidebarMenuSubButton
                                                          asChild
                                                      >
                                                          <a href={subItem.url}>
                                                              <span>
                                                                  {
                                                                      subItem.title
                                                                  }
                                                              </span>
                                                          </a>
                                                      </SidebarMenuSubButton>
                                                  </SidebarMenuSubItem>
                                              ))
                                            : null}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    ),
                )}
            </SidebarMenu>
        </SidebarGroup>
    );
}
