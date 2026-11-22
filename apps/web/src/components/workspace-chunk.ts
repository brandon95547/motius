/**
 * The workspace's chunk: the stage, the keys, the engines, and the bar's
 * controls that only the workspace shows. One loader, so the shell and the bar
 * ask for the same file, once.
 */
export const loadWorkspace = () => import('@/components/Workspace')
