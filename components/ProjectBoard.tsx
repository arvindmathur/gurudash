'use client';

import { useState } from 'react';
import { ProjectBoardData } from '@/lib/types';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { ModuleCard } from './ModuleCard';

const getPriorityColor = (priority: string | null): string => {
  switch (priority) {
    case 'High': return 'bg-red-600';
    case 'Medium': return 'bg-yellow-600';
    case 'Low': return 'bg-green-600';
    default: return 'bg-gray-600';
  }
};

export default function ProjectBoard() {
  const { data, error, lastFetchedAt, refresh } = useAutoRefresh<ProjectBoardData>('/api/projects', 60000);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = data ? Array.from(new Set(data.projects.flatMap(p => p.tags))) : [];
  
  const filteredProjects = data?.projects.filter(p => 
    !selectedTag || p.tags.includes(selectedTag)
  ) || [];

  const grouped = filteredProjects.reduce((acc, project) => {
    if (!acc[project.status]) acc[project.status] = [];
    acc[project.status].push(project);
    return acc;
  }, {} as Record<string, typeof filteredProjects>);

  return (
    <ModuleCard
      title="Project Board"
      lastFetched={lastFetchedAt}
      error={!!error}
      onRefresh={refresh}
    >
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`text-xs px-2 py-1 rounded ${
                selectedTag === tag ? 'bg-blue-600' : 'bg-gray-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {(['Active', 'Pending', 'Future', 'Backlog'] as const).map(status => {
        const projects = grouped[status] || [];
        if (projects.length === 0) return null;
        
        return (
          <div key={status} className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">{status}</h3>
            <div className="space-y-2">
              {projects.map(project => (
                <div key={project.name} className="bg-gray-800/50 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <a
                      href={project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-400 hover:underline"
                    >
                      {project.name}
                    </a>
                    {project.priority && (
                      <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(project.priority)}`}>
                        {project.priority}
                      </span>
                    )}
                  </div>
                  {project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {project.tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {project.nextStep && (
                    <div className="text-xs text-gray-400">
                      Next: {project.nextStep}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </ModuleCard>
  );
}
