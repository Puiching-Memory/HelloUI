import type {
  FC,
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'

export const Table: FC<TableHTMLAttributes<HTMLTableElement>> = ({ style, children, ...props }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', ...style }} {...props}>
    {children}
  </table>
)

export const TableHeader: FC<HTMLAttributes<HTMLTableSectionElement>> = ({ children, ...props }) => (
  <thead {...props}>{children}</thead>
)

export const TableBody: FC<HTMLAttributes<HTMLTableSectionElement>> = ({ children, ...props }) => (
  <tbody {...props}>{children}</tbody>
)

export const TableRow: FC<HTMLAttributes<HTMLTableRowElement>> = ({ style, children, ...props }) => (
  <tr style={{ borderBottom: '1px solid var(--border)', ...style }} {...props}>
    {children}
  </tr>
)

export const TableHeaderCell: FC<ThHTMLAttributes<HTMLTableCellElement>> = ({ style, children, ...props }) => (
  <th
    style={{
      textAlign: 'left',
      fontWeight: 620,
      padding: '10px 12px',
      fontSize: 13,
      color: 'var(--muted-foreground)',
      ...style,
    }}
    {...props}
  >
    {children}
  </th>
)

export const TableCell: FC<TdHTMLAttributes<HTMLTableCellElement>> = ({ style, children, ...props }) => (
  <td style={{ padding: '10px 12px', ...style }} {...props}>
    {children}
  </td>
)

type TableCellLayoutProps = HTMLAttributes<HTMLDivElement> & {
  media?: ReactNode
  truncate?: boolean
}

export const TableCellLayout: FC<TableCellLayoutProps> = ({ media, truncate, children, style, ...props }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, ...style }} {...props}>
    {media ? <span style={{ display: 'inline-flex', alignItems: 'center' }}>{media}</span> : null}
    <span
      style={
        truncate
          ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }
          : { minWidth: 0 }
      }
    >
      {children}
    </span>
  </div>
)

type FieldProps = HTMLAttributes<HTMLDivElement> & {
  label?: ReactNode
  hint?: ReactNode
  required?: boolean
}

export const Field: FC<FieldProps> = ({ label, children, style, hint, required, ...props }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }} {...props}>
    {label ? (
      <label style={{ fontSize: 13, fontWeight: 500 }}>
        {label}
        {required ? <span style={{ color: 'var(--app-error)', marginLeft: 2 }}>*</span> : null}
      </label>
    ) : null}
    {children}
    {hint ? <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{hint}</span> : null}
  </div>
)
