import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { ProjectSubPageHeader } from '../components/ProjectSubPageHeader';
import type { Page } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { timeAgo } from '../utils/format';
import {
  Pin, Search, Send, MessageSquare,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Props {
  projectId: string;
  onNavigate: (page: Page, projectId?: string) => void;
}

export function CommentsPage({ projectId, onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();
  const [newComment, setNewComment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  if (!user || !firm) return null;

  const data = store.forFirm(firm.id);
  const selectedProject = projectId;

  const allComments = data.comments
    .filter(c => c.project_id === selectedProject)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const pinnedComments = allComments.filter(c => c.is_pinned);
  const regularComments = allComments.filter(c => !c.is_pinned);

  const filteredComments = searchQuery
    ? allComments.filter(c => c.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const getProfile = (id: string) => data.profiles.find(p => p.id === id);

  const handlePost = () => {
    if (!newComment.trim()) return;
    store.addComment({
      firm_id: firm.id,
      project_id: selectedProject,
      author_id: user.id,
      content: newComment.trim(),
      is_pinned: false,
    });
    store.addActivityLog({
      firm_id: firm.id,
      user_id: user.id,
      action: 'commented',
      action_label: 'Comment Added',
      module: 'comment',
      entity_type: 'comment',
      entity_id: selectedProject,
      details: `Commented on project`,
    });
    setNewComment('');
  };

  const handlePin = (commentId: string) => {
    store.togglePinComment(commentId);
  };

  const renderComment = (comment: typeof allComments[0], showPin: boolean = true) => {
    const author = getProfile(comment.author_id);
    return (
      <div key={comment.id} className={cn(
        'flex gap-3 p-3 rounded-lg',
        comment.is_pinned ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-slate-200',
      )}>
        <Avatar name={author?.full_name || 'Unknown'} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-slate-900">{author?.full_name}</span>
            <Badge variant="outline" size="sm">{author?.role}</Badge>
            {comment.is_pinned && (
              <Badge variant="warning" size="sm">
                <Pin className="w-3 h-3 mr-0.5" /> Pinned
              </Badge>
            )}
            <span className="text-xs text-slate-400 ml-auto">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{comment.content}</p>
          {showPin && (user.role === 'owner' || user.role === 'architect') && (
            <button
              onClick={() => handlePin(comment.id)}
              className={cn(
                'mt-2 text-xs flex items-center gap-1 transition-colors',
                comment.is_pinned ? 'text-amber-600 hover:text-amber-700' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <Pin className="w-3 h-3" />
              {comment.is_pinned ? 'Unpin' : 'Pin'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <ProjectSubPageHeader projectId={projectId} title="Discussions" subtitle="Project comment threads" onNavigate={onNavigate} />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search comments..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Search Results */}
      {filteredComments && (
        <Card>
          <div className="text-sm text-slate-500 mb-3">
            {filteredComments.length} result{filteredComments.length !== 1 ? 's' : ''} for "{searchQuery}"
          </div>
          <div className="space-y-2">
            {filteredComments.map(c => renderComment(c, false))}
            {filteredComments.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No matching comments found.</p>
            )}
          </div>
        </Card>
      )}

      {/* Pinned Comments */}
      {!searchQuery && pinnedComments.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-1">
            <Pin className="w-3.5 h-3.5" /> Pinned ({pinnedComments.length})
          </h2>
          <div className="space-y-2">
            {pinnedComments.map(c => renderComment(c))}
          </div>
        </div>
      )}

      {/* Comment Thread */}
      {!searchQuery && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            Thread ({regularComments.length})
          </h2>
          <div className="space-y-2">
            {regularComments.map(c => renderComment(c))}
          </div>
        </div>
      )}

      {allComments.length === 0 && !searchQuery && (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No comments yet. Start the conversation!</p>
        </div>
      )}

      {/* New Comment */}
      {!searchQuery && (
        <Card className="sticky bottom-4">
          <div className="flex gap-3">
            <Avatar name={user.full_name} size="sm" />
            <div className="flex-1">
              <Textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={2}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handlePost();
                  }
                }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400">Ctrl+Enter to post</span>
                <Button size="sm" onClick={handlePost} disabled={!newComment.trim()}>
                  <Send className="w-3 h-3" /> Post
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
