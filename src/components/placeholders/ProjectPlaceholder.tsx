import React from 'react';

interface PlaceholderProps {
    key: number
}

function ProjectPlaceholder(props: PlaceholderProps) {
    return (
        <div key={props.key} className="border border-neutral-200 shadow rounded-md p-5 max-w-sm w-full mr-6 my-2">
            <div className="animate-pulse flex space-x-4">
                <div className="rounded-full bg-neutral-300 h-10 w-10"></div>
                <div className="flex-1 space-y-6 py-1">
                    <div className="h-2 bg-neutral-300 rounded"></div>
                    <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="h-2 bg-neutral-300 rounded col-span-2"></div>
                            <div className="h-2 bg-neutral-300 rounded col-span-1"></div>
                        </div>
                        <div className="h-2 bg-neutral-300 rounded"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProjectPlaceholder;