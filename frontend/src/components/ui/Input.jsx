import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const Input = forwardRef(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 ring-offset-white dark:ring-offset-slate-800 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:border-blue-500 hover:border-blue-300 dark:hover:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm hover:shadow-md focus-visible:shadow-lg',
        className
      )}
      {...props}
    />
  )
})

Input.displayName = 'Input'

export default Input

