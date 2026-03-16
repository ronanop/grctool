import { cn } from '../../lib/utils'

const Card = ({ className, children, hover, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/95 shadow-sm transition-all duration-300',
        hover === true && 'card-hover',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const CardHeader = ({ className, children, ...props }) => {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-700', className)} {...props}>
      {children}
    </div>
  )
}

const CardTitle = ({ className, children, ...props }) => {
  return (
    <h3 className={cn('text-xl sm:text-2xl font-semibold leading-none tracking-tight text-slate-900 dark:text-white', className)} {...props}>
      {children}
    </h3>
  )
}

const CardContent = ({ className, children, ...props }) => {
  return (
    <div className={cn('p-6 pt-0', className)} {...props}>
      {children}
    </div>
  )
}

export { Card, CardHeader, CardTitle, CardContent }

