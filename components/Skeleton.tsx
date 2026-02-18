
import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'rect' | 'circle';
}

const Skeleton: React.FC<SkeletonProps> = ({ className, variant = 'rect' }) => {
    const baseClass = "animate-skeleton bg-slate-800/50";
    const variantClass = variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded' : 'rounded-2xl';

    return (
        <div className={`${baseClass} ${variantClass} ${className}`}></div>
    );
};

export default Skeleton;
