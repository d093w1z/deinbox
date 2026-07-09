'use client';

import * as React from 'react';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type UniqueIdentifier,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    IconArrowsSort,
    IconChevronDown,
    IconChevronLeft,
    IconChevronRight,
    IconChevronsLeft,
    IconChevronsRight,
    IconCircleCheckFilled,
    IconDotsVertical,
    IconGripVertical,
    IconLayoutColumns,
    IconLoader,
    IconPaperclip,
    IconSortAscending,
    IconSortDescending,
    IconTrash,
    IconArchive,
} from '@tabler/icons-react';
import type {
    Column,
    ColumnDef,
    ColumnFiltersState,
    OnChangeFn,
    PaginationState,
    Row,
    SortingState,
    VisibilityState,
} from '@tanstack/react-table';
import {
    flexRender,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import type { z } from 'zod';

import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EmailSchema } from '@/types/EmailSchema';

type Email = z.infer<typeof EmailSchema>;

async function bulkAction(
    action: 'delete' | 'archive',
    messageIds: string[],
): Promise<boolean> {
    const res = await fetch('/api/gmail/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, messageIds }),
    });
    return res.ok;
}

function SortableHeader({
    column,
    children,
    align = 'left',
}: {
    column: Column<Email, unknown>;
    children: React.ReactNode;
    align?: 'left' | 'right';
}) {
    const sorted = column.getIsSorted();
    return (
        <Button
            variant='ghost'
            size='sm'
            className={`h-8 ${align === 'right' ? '-mr-3 ml-auto flex w-full justify-end' : '-ml-3'}`}
            onClick={column.getToggleSortingHandler()}
        >
            {children}
            {sorted === 'asc' ? (
                <IconSortAscending className='ml-1 size-3.5' />
            ) : sorted === 'desc' ? (
                <IconSortDescending className='ml-1 size-3.5' />
            ) : (
                <IconArrowsSort className='ml-1 size-3.5 opacity-40' />
            )}
        </Button>
    );
}

function DragHandle({ id }: { id: string }) {
    const { attributes, listeners } = useSortable({ id });
    return (
        <Button
            {...attributes}
            {...listeners}
            variant='ghost'
            size='icon'
            className='text-muted-foreground size-7 hover:bg-transparent'
        >
            <IconGripVertical className='text-muted-foreground size-3' />
            <span className='sr-only'>Drag to reorder</span>
        </Button>
    );
}

function buildColumns(
    onDelete: (id: string) => void,
    onArchive: (id: string) => void,
): ColumnDef<Email>[] {
    return [
        {
            id: 'drag',
            header: () => null,
            cell: ({ row }) => <DragHandle id={row.original.id} />,
        },
        {
            id: 'select',
            header: ({ table }) => (
                <div className='flex items-center justify-center'>
                    <Checkbox
                        checked={
                            table.getIsAllPageRowsSelected() ||
                            (table.getIsSomePageRowsSelected() &&
                                'indeterminate')
                        }
                        onCheckedChange={(value) =>
                            table.toggleAllPageRowsSelected(!!value)
                        }
                        aria-label='Select all'
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className='flex items-center justify-center'>
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label='Select row'
                    />
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: 'from',
            header: ({ column }) => (
                <SortableHeader column={column}>From</SortableHeader>
            ),
            cell: ({ row }) => <TableCellViewer item={row.original} />,
            enableHiding: false,
        },
        {
            accessorKey: 'subject',
            header: ({ column }) => (
                <SortableHeader column={column}>Subject</SortableHeader>
            ),
            cell: ({ row }) => (
                <div className='max-w-64 truncate'>
                    {row.original.subject || '(No subject)'}
                </div>
            ),
        },
        {
            accessorKey: 'category',
            header: ({ column }) => (
                <SortableHeader column={column}>Category</SortableHeader>
            ),
            cell: ({ row }) => (
                <Badge
                    variant='outline'
                    className='text-muted-foreground px-1.5 capitalize'
                >
                    {row.original.category}
                </Badge>
            ),
        },
        {
            accessorKey: 'isUnread',
            header: ({ column }) => (
                <SortableHeader column={column}>Status</SortableHeader>
            ),
            cell: ({ row }) => (
                <Badge
                    variant='outline'
                    className='text-muted-foreground px-1.5'
                >
                    {row.original.isUnread ? (
                        <IconLoader className='text-blue-500' />
                    ) : (
                        <IconCircleCheckFilled className='fill-green-500 dark:fill-green-400' />
                    )}
                    {row.original.isUnread ? 'Unread' : 'Read'}
                </Badge>
            ),
        },
        {
            accessorKey: 'date',
            header: ({ column }) => (
                <SortableHeader column={column} align='right'>
                    Date
                </SortableHeader>
            ),
            cell: ({ row }) => (
                <div className='text-muted-foreground text-right text-sm'>
                    {new Date(row.original.date).toLocaleDateString('en-US')}
                </div>
            ),
        },
        {
            accessorKey: 'size',
            header: ({ column }) => (
                <SortableHeader column={column} align='right'>
                    Size
                </SortableHeader>
            ),
            cell: ({ row }) => (
                <div className='text-muted-foreground text-right text-sm'>
                    {(row.original.size / 1024).toFixed(1)} KB
                </div>
            ),
        },
        {
            accessorKey: 'hasAttachment',
            header: 'Attachment',
            cell: ({ row }) =>
                row.original.hasAttachment ? (
                    <IconPaperclip className='text-muted-foreground size-4' />
                ) : null,
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant='ghost'
                            className='data-[state=open]:bg-muted text-muted-foreground flex size-8'
                            size='icon'
                        >
                            <IconDotsVertical />
                            <span className='sr-only'>Open menu</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end' className='w-32'>
                        <DropdownMenuItem
                            onClick={() => onArchive(row.original.id)}
                        >
                            Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant='destructive'
                            onClick={() => onDelete(row.original.id)}
                        >
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];
}

function DraggableRow({ row }: { row: Row<Email> }) {
    const { transform, transition, setNodeRef, isDragging } = useSortable({
        id: row.original.id,
    });

    return (
        <TableRow
            data-state={row.getIsSelected() && 'selected'}
            data-dragging={isDragging}
            ref={setNodeRef}
            className='relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80'
            style={{
                transform: CSS.Transform.toString(transform),
                transition: transition,
            }}
        >
            {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
            ))}
        </TableRow>
    );
}

const TAB_CATEGORY_MAP: Record<string, string | null> = {
    all: null,
    inbox: 'primary',
    updates: 'updates',
    promotions: 'promotions',
    social: 'social',
};

export function EmailTable({
    data: initialData,
    showCategoryTabs = true,
    manualPagination = false,
    pageCount,
    pagination: controlledPagination,
    onPaginationChange: onPaginationChangeProp,
    manualSorting = false,
    sorting: controlledSorting,
    onSortingChange: onSortingChangeProp,
}: {
    data: Email[] | undefined;
    // Callers that already filter by category themselves (server-side,
    // URL-synced) should pass false — otherwise this table's own tabs
    // silently re-filter on top with a different, narrower set of
    // categories (no "forums"), which is confusing and easy to get out of
    // sync with the caller's own filter.
    showCategoryTabs?: boolean;
    // Server-driven mode: caller fetches one page of already-sorted data at
    // a time (e.g. /emails, which needs to reach every message in a large
    // mailbox, not just whatever fits in one bounded client-side fetch).
    // When these are set, `data` is assumed to be exactly the current page
    // and this table stops slicing/sorting it locally — the caller's
    // fetch is the source of truth. Omit them (the default) to keep the
    // existing fully client-side behavior used by the dashboard widget.
    manualPagination?: boolean;
    pageCount?: number;
    pagination?: PaginationState;
    onPaginationChange?: OnChangeFn<PaginationState>;
    manualSorting?: boolean;
    sorting?: SortingState;
    onSortingChange?: OnChangeFn<SortingState>;
}) {
    const [data, setData] = React.useState<Email[]>(() => initialData ?? []);
    const [activeTab, setActiveTab] = React.useState('all');
    const [rowSelection, setRowSelection] = React.useState({});
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [internalSorting, setInternalSorting] = React.useState<SortingState>(
        [],
    );
    const [internalPagination, setInternalPagination] =
        React.useState<PaginationState>({
            pageIndex: 0,
            pageSize: 10,
        });
    const sorting = manualSorting ? (controlledSorting ?? []) : internalSorting;
    const pagination = manualPagination
        ? (controlledPagination ?? { pageIndex: 0, pageSize: 10 })
        : internalPagination;
    const [isBusy, setIsBusy] = React.useState(false);
    const sortableId = React.useId();
    const sensors = useSensors(
        useSensor(MouseSensor, {}),
        useSensor(TouchSensor, {}),
        useSensor(KeyboardSensor, {}),
    );

    const tabData = React.useMemo(() => {
        const category = TAB_CATEGORY_MAP[activeTab];
        if (!category) return data;
        return data.filter((e) => e.category === category);
    }, [data, activeTab]);

    const dataIds = React.useMemo<UniqueIdentifier[]>(
        () => tabData.map(({ id }) => id),
        [tabData],
    );

    const removeIds = React.useCallback((ids: string[]) => {
        setData((prev) => prev.filter((e) => !ids.includes(e.id)));
    }, []);

    const handleDelete = React.useCallback(
        async (id: string) => {
            if (isBusy) return;
            setIsBusy(true);
            const ok = await bulkAction('delete', [id]);
            if (ok) removeIds([id]);
            setIsBusy(false);
        },
        [isBusy, removeIds],
    );

    const handleArchive = React.useCallback(
        async (id: string) => {
            if (isBusy) return;
            setIsBusy(true);
            const ok = await bulkAction('archive', [id]);
            if (ok) removeIds([id]);
            setIsBusy(false);
        },
        [isBusy, removeIds],
    );

    const columns = React.useMemo(
        () => buildColumns(handleDelete, handleArchive),
        [handleDelete, handleArchive],
    );

    const table = useReactTable({
        data: tabData,
        columns,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            columnFilters,
            pagination,
        },
        getRowId: (row) => row.id,
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: manualSorting
            ? onSortingChangeProp
            : setInternalSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: manualPagination
            ? onPaginationChangeProp
            : setInternalPagination,
        manualSorting,
        manualPagination,
        pageCount: manualPagination ? (pageCount ?? -1) : undefined,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: manualPagination
            ? undefined
            : getPaginationRowModel(),
        getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
    });

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (active && over && active.id !== over.id) {
            setData((prev) => {
                const oldIndex = dataIds.indexOf(active.id);
                const newIndex = dataIds.indexOf(over.id);
                return arrayMove(prev, oldIndex, newIndex);
            });
        }
    }

    const selectedIds = table
        .getSelectedRowModel()
        .rows.map((r) => r.original.id);

    async function handleBulkDelete() {
        if (!selectedIds.length || isBusy) return;
        setIsBusy(true);
        const ok = await bulkAction('delete', selectedIds);
        if (ok) {
            removeIds(selectedIds);
            setRowSelection({});
        }
        setIsBusy(false);
    }

    async function handleBulkArchive() {
        if (!selectedIds.length || isBusy) return;
        setIsBusy(true);
        const ok = await bulkAction('archive', selectedIds);
        if (ok) {
            removeIds(selectedIds);
            setRowSelection({});
        }
        setIsBusy(false);
    }

    return (
        <Tabs
            value={activeTab}
            onValueChange={(v) => {
                setActiveTab(v);
                setRowSelection({});
                if (!manualPagination) {
                    setInternalPagination((p) => ({ ...p, pageIndex: 0 }));
                }
            }}
            className='w-full flex-col justify-start gap-6'
        >
            <div className='flex items-center justify-between px-4 lg:px-6'>
                {showCategoryTabs && (
                    <>
                        <Label htmlFor='view-selector' className='sr-only'>
                            View
                        </Label>
                        <Select value={activeTab} onValueChange={setActiveTab}>
                            <SelectTrigger
                                className='flex w-fit @4xl/main:hidden'
                                size='sm'
                                id='view-selector'
                            >
                                <SelectValue placeholder='Select a view' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='all'>All</SelectItem>
                                <SelectItem value='inbox'>Inbox</SelectItem>
                                <SelectItem value='updates'>Updates</SelectItem>
                                <SelectItem value='promotions'>
                                    Promotions
                                </SelectItem>
                                <SelectItem value='social'>Social</SelectItem>
                            </SelectContent>
                        </Select>
                        <TabsList className='**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex'>
                            <TabsTrigger value='all'>All</TabsTrigger>
                            <TabsTrigger value='inbox'>Inbox</TabsTrigger>
                            <TabsTrigger value='updates'>Updates</TabsTrigger>
                            <TabsTrigger value='promotions'>
                                Promotions
                            </TabsTrigger>
                            <TabsTrigger value='social'>Social</TabsTrigger>
                        </TabsList>
                    </>
                )}
                <div className='ml-auto flex items-center gap-2'>
                    {selectedIds.length > 0 && (
                        <>
                            <Button
                                variant='outline'
                                size='sm'
                                disabled={isBusy}
                                onClick={handleBulkArchive}
                            >
                                <IconArchive className='mr-1 size-4' />
                                Archive ({selectedIds.length})
                            </Button>
                            <Button
                                variant='destructive'
                                size='sm'
                                disabled={isBusy}
                                onClick={handleBulkDelete}
                            >
                                <IconTrash className='mr-1 size-4' />
                                Delete ({selectedIds.length})
                            </Button>
                        </>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant='outline' size='sm'>
                                <IconLayoutColumns />
                                <span className='hidden lg:inline'>
                                    Customize Columns
                                </span>
                                <span className='lg:hidden'>Columns</span>
                                <IconChevronDown />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' className='w-56'>
                            {table
                                .getAllColumns()
                                .filter(
                                    (column) =>
                                        typeof column.accessorFn !==
                                            'undefined' && column.getCanHide(),
                                )
                                .map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className='capitalize'
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                    >
                                        {column.id}
                                    </DropdownMenuCheckboxItem>
                                ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <TabsContent
                value={activeTab}
                className='relative flex flex-col gap-4 overflow-auto px-4 lg:px-6'
            >
                <div className='overflow-hidden rounded-lg border'>
                    <DndContext
                        collisionDetection={closestCenter}
                        modifiers={[restrictToVerticalAxis]}
                        onDragEnd={handleDragEnd}
                        sensors={sensors}
                        id={sortableId}
                    >
                        <Table>
                            <TableHeader className='bg-muted sticky top-0 z-10'>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <TableHead
                                                key={header.id}
                                                colSpan={header.colSpan}
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                          header.column
                                                              .columnDef.header,
                                                          header.getContext(),
                                                      )}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody className='**:data-[slot=table-cell]:first:w-8'>
                                {table.getRowModel().rows?.length ? (
                                    <SortableContext
                                        items={dataIds}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {table.getRowModel().rows.map((row) => (
                                            <DraggableRow
                                                key={row.id}
                                                row={row}
                                            />
                                        ))}
                                    </SortableContext>
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className='h-24 text-center'
                                        >
                                            No results.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </DndContext>
                </div>
                <div className='flex items-center justify-between px-4'>
                    <div className='text-muted-foreground hidden flex-1 text-sm lg:flex'>
                        {table.getFilteredSelectedRowModel().rows.length} of{' '}
                        {table.getFilteredRowModel().rows.length} row(s)
                        selected.
                    </div>
                    <div className='flex w-full items-center gap-8 lg:w-fit'>
                        <div className='hidden items-center gap-2 lg:flex'>
                            <Label
                                htmlFor='rows-per-page'
                                className='text-sm font-medium'
                            >
                                Rows per page
                            </Label>
                            <Select
                                value={`${table.getState().pagination.pageSize}`}
                                onValueChange={(value) => {
                                    table.setPageSize(Number(value));
                                }}
                            >
                                <SelectTrigger
                                    size='sm'
                                    className='w-20'
                                    id='rows-per-page'
                                >
                                    <SelectValue
                                        placeholder={
                                            table.getState().pagination.pageSize
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent side='top'>
                                    {[10, 20, 30, 40, 50].map((pageSize) => (
                                        <SelectItem
                                            key={pageSize}
                                            value={`${pageSize}`}
                                        >
                                            {pageSize}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='flex w-fit items-center justify-center text-sm font-medium'>
                            Page {table.getState().pagination.pageIndex + 1} of{' '}
                            {table.getPageCount()}
                        </div>
                        <div className='ml-auto flex items-center gap-2 lg:ml-0'>
                            <Button
                                variant='outline'
                                className='hidden h-8 w-8 p-0 lg:flex'
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className='sr-only'>
                                    Go to first page
                                </span>
                                <IconChevronsLeft />
                            </Button>
                            <Button
                                variant='outline'
                                className='size-8'
                                size='icon'
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className='sr-only'>
                                    Go to previous page
                                </span>
                                <IconChevronLeft />
                            </Button>
                            <Button
                                variant='outline'
                                className='size-8'
                                size='icon'
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className='sr-only'>Go to next page</span>
                                <IconChevronRight />
                            </Button>
                            <Button
                                variant='outline'
                                className='hidden size-8 lg:flex'
                                size='icon'
                                onClick={() =>
                                    table.setPageIndex(table.getPageCount() - 1)
                                }
                                disabled={!table.getCanNextPage()}
                            >
                                <span className='sr-only'>Go to last page</span>
                                <IconChevronsRight />
                            </Button>
                        </div>
                    </div>
                </div>
            </TabsContent>
        </Tabs>
    );
}

function TableCellViewer({ item }: { item: Email }) {
    const isMobile = useIsMobile();

    return (
        <Drawer direction={isMobile ? 'bottom' : 'right'}>
            <DrawerTrigger asChild>
                <Button variant='link' className='w-fit px-0 text-left'>
                    {item.from || '(Unknown sender)'}
                </Button>
            </DrawerTrigger>

            <DrawerContent>
                <DrawerHeader className='gap-1'>
                    <DrawerTitle>{item.subject || '(No subject)'}</DrawerTitle>
                    <DrawerDescription>
                        {item.from} → {item.to}
                    </DrawerDescription>
                </DrawerHeader>

                <div className='flex flex-col gap-6 overflow-y-auto px-4 text-sm'>
                    <div className='flex flex-col gap-1'>
                        <div className='text-muted-foreground text-xs'>
                            From
                        </div>
                        <div>{item.from}</div>

                        <div className='text-muted-foreground mt-3 text-xs'>
                            To
                        </div>
                        <div>{item.to}</div>

                        <div className='text-muted-foreground mt-3 text-xs'>
                            Date
                        </div>
                        <div>{new Date(item.date).toLocaleString('en-US')}</div>
                    </div>

                    <div className='flex flex-wrap items-center gap-2'>
                        <Badge variant='outline'>{item.category}</Badge>
                        {item.isUnread && (
                            <Badge variant='secondary'>Unread</Badge>
                        )}
                        {item.hasAttachment && (
                            <Badge
                                variant='secondary'
                                className='flex items-center gap-1'
                            >
                                <IconPaperclip className='size-3' /> Attachment
                            </Badge>
                        )}
                    </div>

                    {item.labels.length > 0 && (
                        <div>
                            <div className='text-muted-foreground mb-1 text-xs'>
                                Labels
                            </div>
                            <div className='flex flex-wrap gap-1'>
                                {item.labels.map((label) => (
                                    <Badge
                                        key={label}
                                        variant='secondary'
                                        className='capitalize'
                                    >
                                        {label}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <div className='text-muted-foreground mb-1 text-xs'>
                            Preview
                        </div>
                        <p className='text-muted-foreground whitespace-pre-line'>
                            {item.snippet || 'No preview available.'}
                        </p>
                    </div>

                    <div className='text-muted-foreground space-y-1 rounded-md border p-3 text-xs'>
                        <div>
                            <strong>ID:</strong> {item.id}
                        </div>
                        <div>
                            <strong>Thread:</strong> {item.threadId}
                        </div>
                        <div>
                            <strong>History:</strong> {item.historyId}
                        </div>
                        <div>
                            <strong>Internal Date:</strong> {item.internalDate}
                        </div>
                        <div>
                            <strong>Size:</strong>{' '}
                            {(item.size / 1024).toFixed(1)} KB
                        </div>
                    </div>
                </div>

                <DrawerFooter>
                    <DrawerClose asChild>
                        <Button variant='outline'>Close</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
