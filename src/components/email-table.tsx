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
    IconPlus,
    IconTrendingUp,
} from '@tabler/icons-react';
import {
    ColumnDef,
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    Row,
    SortingState,
    useReactTable,
    VisibilityState,
} from '@tanstack/react-table';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { toast } from 'sonner';
import { z } from 'zod';

import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmailSchema } from '@/types/EmailSchema';

// Create a separate component for the drag handle
function DragHandle({ id }: { id: string }) {
    const { attributes, listeners } = useSortable({
        id,
    });

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

const columns: ColumnDef<z.infer<typeof EmailSchema>>[] = [
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
                        (table.getIsSomePageRowsSelected() && 'indeterminate')
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
        header: 'From',
        cell: ({ row }) => {
            return <TableCellViewer item={row.original} />;
        },
        enableHiding: false,
    },
    {
        accessorKey: 'type',
        header: 'Section Type',
        cell: ({ row }) => (
            <div className='w-32'>
                <Badge
                    variant='outline'
                    className='text-muted-foreground px-1.5'
                >
                    {row.original.type}
                </Badge>
            </div>
        ),
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
            <Badge variant='outline' className='text-muted-foreground px-1.5'>
                {row.original.status === 'Done' ? (
                    <IconCircleCheckFilled className='fill-green-500 dark:fill-green-400' />
                ) : (
                    <IconLoader />
                )}
                {row.original.status}
            </Badge>
        ),
    },
    {
        accessorKey: 'target',
        header: () => <div className='w-full text-right'>Target</div>,
        cell: ({ row }) => (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    toast.promise(
                        new Promise((resolve) => setTimeout(resolve, 1000)),
                        {
                            loading: `Saving ${row.original.subject}`,
                            success: 'Done',
                            error: 'Error',
                        },
                    );
                }}
            >
                <Label
                    htmlFor={`${row.original.id}-target`}
                    className='sr-only'
                >
                    Target
                </Label>
                <Input
                    className='hover:bg-input/30 focus-visible:bg-background dark:hover:bg-input/30 dark:focus-visible:bg-input/30 h-8 w-16 border-transparent bg-transparent text-right shadow-none focus-visible:border dark:bg-transparent'
                    defaultValue={row.original.target}
                    id={`${row.original.id}-target`}
                />
            </form>
        ),
    },
    {
        accessorKey: 'limit',
        header: () => <div className='w-full text-right'>Limit</div>,
        cell: ({ row }) => (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    toast.promise(
                        new Promise((resolve) => setTimeout(resolve, 1000)),
                        {
                            loading: `Saving ${row.original.subject}`,
                            success: 'Done',
                            error: 'Error',
                        },
                    );
                }}
            >
                <Label htmlFor={`${row.original.id}-limit`} className='sr-only'>
                    Limit
                </Label>
                <Input
                    className='hover:bg-input/30 focus-visible:bg-background dark:hover:bg-input/30 dark:focus-visible:bg-input/30 h-8 w-16 border-transparent bg-transparent text-right shadow-none focus-visible:border dark:bg-transparent'
                    defaultValue={row.original.limit}
                    id={`${row.original.id}-limit`}
                />
            </form>
        ),
    },
    {
        accessorKey: 'reviewer',
        header: 'Reviewer',
        cell: ({ row }) => {
            const isAssigned = row.original.reviewer !== 'Assign reviewer';

            if (isAssigned) {
                return row.original.reviewer;
            }

            return (
                <>
                    <Label
                        htmlFor={`${row.original.id}-reviewer`}
                        className='sr-only'
                    >
                        Reviewer
                    </Label>
                    <Select>
                        <SelectTrigger
                            className='w-38 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate'
                            size='sm'
                            id={`${row.original.id}-reviewer`}
                        >
                            <SelectValue placeholder='Assign reviewer' />
                        </SelectTrigger>
                        <SelectContent align='end'>
                            <SelectItem value='Eddie Lake'>
                                Eddie Lake
                            </SelectItem>
                            <SelectItem value='Jamik Tashpulatov'>
                                Jamik Tashpulatov
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </>
            );
        },
    },
    {
        id: 'actions',
        cell: () => (
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
                    <DropdownMenuItem>Edit</DropdownMenuItem>
                    <DropdownMenuItem>Make a copy</DropdownMenuItem>
                    <DropdownMenuItem>Favorite</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant='destructive'>
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        ),
    },
];

function DraggableRow({ row }: { row: Row<z.infer<typeof EmailSchema>> }) {
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

export function EmailTable({
    data: initialData,
}: {
    data: z.infer<typeof EmailSchema>[] | undefined;
}) {
    const [data, setData] = React.useState(() => initialData);
    const [rowSelection, setRowSelection] = React.useState({});
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [pagination, setPagination] = React.useState({
        pageIndex: 0,
        pageSize: 10,
    });
    const sortableId = React.useId();
    const sensors = useSensors(
        useSensor(MouseSensor, {}),
        useSensor(TouchSensor, {}),
        useSensor(KeyboardSensor, {}),
    );

    const dataIds = React.useMemo<UniqueIdentifier[]>(
        () => data?.map(({ id }) => id) || [],
        [data],
    );

    const table = useReactTable({
        data: data || [],
        columns,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            columnFilters,
            pagination,
        },
        getRowId: (row) => row.id.toString(),
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
    });

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (active && over && active.id !== over.id) {
            setData((data) => {
                const oldIndex = dataIds.indexOf(active.id);
                const newIndex = dataIds.indexOf(over.id);
                return arrayMove(data ?? [], oldIndex, newIndex);
            });
        }
    }

    return (
        <Tabs
            defaultValue='all'
            className='w-full flex-col justify-start gap-6'
        >
            <div className='flex items-center justify-between px-4 lg:px-6'>
                <Label htmlFor='view-selector' className='sr-only'>
                    View
                </Label>
                <Select defaultValue='all'>
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
                        <SelectItem value='promotions'>Promotions</SelectItem>
                    </SelectContent>
                </Select>
                <TabsList className='**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex'>
                    <TabsTrigger value='all'>All</TabsTrigger>
                    <TabsTrigger value='inbox'>
                        Inbox <Badge variant='secondary'>3</Badge>
                    </TabsTrigger>
                    <TabsTrigger value='updates'>
                        Updates <Badge variant='secondary'>2</Badge>
                    </TabsTrigger>
                    <TabsTrigger value='promotions'>Promotions</TabsTrigger>
                </TabsList>
                <div className='flex items-center gap-2'>
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
                                .map((column) => {
                                    return (
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
                                    );
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant='outline' size='sm'>
                        <IconPlus />
                        <span className='hidden lg:inline'>Add Section</span>
                    </Button>
                </div>
            </div>
            <TabsContent
                value='all'
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
                                        {headerGroup.headers.map((header) => {
                                            return (
                                                <TableHead
                                                    key={header.id}
                                                    colSpan={header.colSpan}
                                                >
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                              header.column
                                                                  .columnDef
                                                                  .header,
                                                              header.getContext(),
                                                          )}
                                                </TableHead>
                                            );
                                        })}
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
            <TabsContent
                value='past-performance'
                className='flex flex-col px-4 lg:px-6'
            >
                <div className='aspect-video w-full flex-1 rounded-lg border border-dashed'></div>
            </TabsContent>
            <TabsContent
                value='key-personnel'
                className='flex flex-col px-4 lg:px-6'
            >
                <div className='aspect-video w-full flex-1 rounded-lg border border-dashed'></div>
            </TabsContent>
            <TabsContent
                value='focus-documents'
                className='flex flex-col px-4 lg:px-6'
            >
                <div className='aspect-video w-full flex-1 rounded-lg border border-dashed'></div>
            </TabsContent>
        </Tabs>
    );
}

const chartData = [
    { month: 'January', desktop: 186, mobile: 80 },
    { month: 'February', desktop: 305, mobile: 200 },
    { month: 'March', desktop: 237, mobile: 120 },
    { month: 'April', desktop: 73, mobile: 190 },
    { month: 'May', desktop: 209, mobile: 130 },
    { month: 'June', desktop: 214, mobile: 140 },
];

const chartConfig = {
    desktop: {
        label: 'Desktop',
        color: 'var(--primary)',
    },
    mobile: {
        label: 'Mobile',
        color: 'var(--primary)',
    },
} satisfies ChartConfig;

function TableCellViewer({ item }: { item: z.infer<typeof EmailSchema> }) {
    const isMobile = useIsMobile();

    return (
        <Drawer direction={isMobile ? 'bottom' : 'right'}>
            <DrawerTrigger asChild>
                <Button variant='link' className='px-0 text-left w-fit'>
                    {item.from || '(No subject)'}
                </Button>
            </DrawerTrigger>

            <DrawerContent>
                <DrawerHeader className='gap-1'>
                    <DrawerTitle>{item.subject || '(No subject)'}</DrawerTitle>
                    <DrawerDescription>
                        {item.from} → {item.to}
                    </DrawerDescription>
                </DrawerHeader>

                <div className='flex flex-col gap-6 px-4 text-sm overflow-y-auto'>
                    {/* Basic Email Info */}
                    <div className='flex flex-col gap-1'>
                        <div className='text-muted-foreground text-xs'>
                            From
                        </div>
                        <div>{item.from}</div>

                        <div className='text-muted-foreground text-xs mt-3'>
                            To
                        </div>
                        <div>{item.to}</div>

                        <div className='text-muted-foreground text-xs mt-3'>
                            Date
                        </div>
                        <div>{new Date(item.date).toLocaleString()}</div>
                    </div>

                    {/* Category + Labels */}
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

                    {/* Labels section */}
                    {item.labels.length > 0 && (
                        <div>
                            <div className='text-muted-foreground text-xs mb-1'>
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

                    {/* Snippet */}
                    <div>
                        <div className='text-muted-foreground text-xs mb-1'>
                            Preview
                        </div>
                        <p className='text-muted-foreground whitespace-pre-line'>
                            {item.snippet || 'No preview available.'}
                        </p>
                    </div>

                    {/* Metadata Section */}
                    <div className='border rounded-md p-3 text-xs text-muted-foreground space-y-1'>
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
