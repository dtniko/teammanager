import React from 'react';

const LoadingSpinner = ({
                            size = 'medium',
                            color = 'blue',
                            text = null,
                            className = ''
                        }) => {
    const sizeClasses = {
        small: 'h-4 w-4',
        medium: 'h-8 w-8',
        large: 'h-12 w-12',
        xlarge: 'h-16 w-16'
    };

    const colorClasses = {
        blue: 'text-blue-600',
        white: 'text-white',
        gray: 'text-gray-600',
        green: 'text-green-600',
        red: 'text-red-600'
    };

    const textSizeClasses = {
        small: 'text-sm',
        medium: 'text-base',
        large: 'text-lg',
        xlarge: 'text-xl'
    };

    return (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <div className="relative">
                <div className={`
          ${sizeClasses[size]} 
          ${colorClasses[color]}
          animate-spin
        `}>
                    <svg
                        className="animate-spin h-full w-full"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                </div>
            </div>

            {text && (
                <p className={`
          mt-3 text-center font-medium 
          ${textSizeClasses[size]} 
          ${colorClasses[color]}
        `}>
                    {text}
                </p>
            )}
        </div>
    );
};

// Componente per overlay a schermo intero
export const FullScreenSpinner = ({ text = 'Caricamento...' }) => {
    return (
        <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
            <LoadingSpinner size="large" text={text} />
        </div>
    );
};

// Componente per overlay su contenuto
export const OverlaySpinner = ({ text = 'Caricamento...', children }) => {
    return (
        <div className="relative">
            {children}
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                <LoadingSpinner size="medium" text={text} />
            </div>
        </div>
    );
};

// Componente per pulsanti con loading
export const ButtonSpinner = ({ loading, children, ...props }) => {
    return (
        <button {...props} disabled={loading || props.disabled}>
            <div className="flex items-center justify-center">
                {loading && (
                    <LoadingSpinner size="small" color="white" className="mr-2" />
                )}
                {children}
            </div>
        </button>
    );
};

// Componente per skeleton loading
export const SkeletonLoader = ({
                                   lines = 3,
                                   height = 'h-4',
                                   className = ''
                               }) => {
    return (
        <div className={`animate-pulse ${className}`}>
            {Array.from({ length: lines }).map((_, index) => (
                <div
                    key={index}
                    className={`
            bg-gray-200 rounded ${height} mb-3 last:mb-0
            ${index === lines - 1 ? 'w-3/4' : 'w-full'}
          `}
                />
            ))}
        </div>
    );
};

// Componente per card skeleton
export const CardSkeleton = ({ className = '' }) => {
    return (
        <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
            <div className="animate-pulse">
                <div className="flex items-center space-x-4 mb-4">
                    <div className="rounded-full bg-gray-200 h-10 w-10" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded" />
                    <div className="h-4 bg-gray-200 rounded w-5/6" />
                    <div className="h-4 bg-gray-200 rounded w-4/6" />
                </div>
            </div>
        </div>
    );
};

// Componente per table skeleton
export const TableSkeleton = ({
                                  rows = 5,
                                  columns = 4,
                                  className = ''
                              }) => {
    return (
        <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
            <div className="animate-pulse">
                {/* Header */}
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <div className="grid grid-cols-4 gap-4">
                        {Array.from({ length: columns }).map((_, index) => (
                            <div key={index} className="h-4 bg-gray-200 rounded" />
                        ))}
                    </div>
                </div>

                {/* Rows */}
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <div key={rowIndex} className="px-6 py-4 border-b border-gray-200 last:border-b-0">
                        <div className="grid grid-cols-4 gap-4">
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <div key={colIndex} className="h-4 bg-gray-200 rounded" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LoadingSpinner;
