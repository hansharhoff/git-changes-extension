import { execFile } from 'node:child_process';
import * as vscode from 'vscode';

const extensionId = 'git-remote-changes-alert';
const gitExtensionId = 'vscode.git';

interface GitExtension {
	enabled: boolean;
	getAPI(version: 1): GitApi;
	onDidChangeEnablement?: vscode.Event<boolean>;
}

interface GitApi {
	repositories: GitRepository[];
	onDidOpenRepository: vscode.Event<GitRepository>;
	onDidCloseRepository: vscode.Event<GitRepository>;
}

interface GitRepository {
	rootUri: vscode.Uri;
	state: GitRepositoryState;
	fetch?(remote?: string, ref?: string, depth?: number): Promise<void>;
}

interface GitRepositoryState {
	HEAD?: GitBranch;
	onDidChange?: vscode.Event<void>;
}

interface GitBranch {
	name?: string;
	upstream?: GitUpstreamBranch;
	ahead?: number;
	behind?: number;
}

interface GitUpstreamBranch {
	remote: string;
	name: string;
}

interface RepositorySignal {
	repositoryName: string;
	branchName: string;
	upstreamBehind: number;
	defaultAhead: number;
	defaultBranchRef?: string;
}

class GitRemoteChangesAlert implements vscode.Disposable {
	private readonly statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 115);
	private readonly disposables: vscode.Disposable[] = [];
	private readonly repositoryDisposables = new Map<GitRepository, vscode.Disposable>();
	private gitApi: GitApi | undefined;
	private updateTimer: NodeJS.Timeout | undefined;
	private latestRepository: GitRepository | undefined;
	private isFetching = false;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.statusBarItem.name = 'Git Remote Changes Alert';
		this.statusBarItem.command = `${extensionId}.fetchAndRefresh`;
		this.statusBarItem.accessibilityInformation = {
			label: 'Git remote changes alert',
			role: 'button'
		};

		this.disposables.push(
			this.statusBarItem,
			vscode.window.onDidChangeActiveTextEditor(() => this.scheduleUpdate()),
			vscode.workspace.onDidChangeWorkspaceFolders(() => this.scheduleUpdate()),
			vscode.workspace.onDidChangeConfiguration(event => {
				if (event.affectsConfiguration(extensionId)) {
					this.scheduleUpdate();
				}
			}),
			vscode.commands.registerCommand(`${extensionId}.refresh`, () => this.updateStatus()),
			vscode.commands.registerCommand(`${extensionId}.fetchAndRefresh`, () => this.fetchAndRefresh())
		);
	}

	async start(): Promise<void> {
		const extension = vscode.extensions.getExtension<GitExtension>(gitExtensionId);

		if (!extension) {
			this.showMissingGitExtension();
			return;
		}

		const gitExtension = extension.isActive ? extension.exports : await extension.activate();

		if (!gitExtension.enabled) {
			this.showMissingGitExtension();
			this.disposables.push(gitExtension.onDidChangeEnablement?.(enabled => {
				if (enabled) {
					void this.start();
				}
			}) ?? new vscode.Disposable(() => undefined));
			return;
		}

		this.gitApi = gitExtension.getAPI(1);
		this.disposables.push(
			this.gitApi.onDidOpenRepository(repository => this.watchRepository(repository)),
			this.gitApi.onDidCloseRepository(repository => this.unwatchRepository(repository))
		);

		for (const repository of this.gitApi.repositories) {
			this.watchRepository(repository);
		}

		await this.updateStatus();
	}

	dispose(): void {
		if (this.updateTimer) {
			clearTimeout(this.updateTimer);
		}

		for (const disposable of this.repositoryDisposables.values()) {
			disposable.dispose();
		}

		for (const disposable of this.disposables) {
			disposable.dispose();
		}
	}

	private watchRepository(repository: GitRepository): void {
		if (!this.repositoryDisposables.has(repository) && repository.state.onDidChange) {
			this.repositoryDisposables.set(repository, repository.state.onDidChange(() => this.scheduleUpdate()));
		}

		this.scheduleUpdate();
	}

	private unwatchRepository(repository: GitRepository): void {
		this.repositoryDisposables.get(repository)?.dispose();
		this.repositoryDisposables.delete(repository);
		this.scheduleUpdate();
	}

	private scheduleUpdate(): void {
		if (this.updateTimer) {
			clearTimeout(this.updateTimer);
		}

		this.updateTimer = setTimeout(() => {
			void this.updateStatus();
		}, 250);
	}

	private async fetchAndRefresh(): Promise<void> {
		const repository = this.latestRepository ?? this.getActiveRepository();

		if (!repository || this.isFetching) {
			await this.updateStatus();
			return;
		}

		this.isFetching = true;
		this.statusBarItem.text = '$(sync~spin) Fetching Git';
		this.statusBarItem.tooltip = 'Fetching remote Git refs...';
		this.statusBarItem.backgroundColor = undefined;
		this.statusBarItem.show();

		try {
			if (repository.fetch) {
				await repository.fetch();
			} else {
				await runGit(repository.rootUri, ['fetch', '--all', '--prune']);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			void vscode.window.showWarningMessage(`Git Remote Changes Alert could not fetch: ${message}`);
		} finally {
			this.isFetching = false;
			await this.updateStatus();
		}
	}

	private async updateStatus(): Promise<void> {
		try {
			const repository = this.getActiveRepository();
			this.latestRepository = repository;

			if (!repository) {
				this.statusBarItem.hide();
				return;
			}

			const signal = await this.getRepositorySignal(repository);

			if (!signal) {
				this.statusBarItem.hide();
				return;
			}

			const hasUpstreamChanges = signal.upstreamBehind > 0;
			const hasDefaultBranchChanges = signal.defaultAhead > 0;

			if (!hasUpstreamChanges && !hasDefaultBranchChanges) {
				if (getConfiguration<boolean>('showWhenUpToDate', false, repository.rootUri)) {
					this.statusBarItem.text = '$(check) Git up to date';
					this.statusBarItem.tooltip = this.createTooltip(signal, false);
					this.statusBarItem.backgroundColor = undefined;
					this.statusBarItem.show();
				} else {
					this.statusBarItem.hide();
				}

				return;
			}

			this.statusBarItem.text = formatStatusText(signal);
			this.statusBarItem.tooltip = this.createTooltip(signal, true);
			this.statusBarItem.backgroundColor = new vscode.ThemeColor(
				hasUpstreamChanges ? 'statusBarItem.errorBackground' : 'statusBarItem.warningBackground'
			);
			this.statusBarItem.show();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.statusBarItem.hide();
			void vscode.window.showWarningMessage(`Git Remote Changes Alert could not refresh: ${message}`);
		}
	}

	private async getRepositorySignal(repository: GitRepository): Promise<RepositorySignal | undefined> {
		const head = repository.state.HEAD;
		const branchName = head?.name;

		if (!branchName) {
			return undefined;
		}

		const upstreamBehind = await this.getUpstreamBehind(repository, head);
		const defaultBranchRef = await findDefaultBranchRef(repository, head.upstream?.remote);
		const defaultAhead = defaultBranchRef && !isCurrentBranchDefault(branchName, defaultBranchRef)
			? await getCommitCount(repository.rootUri, ['rev-list', '--count', `HEAD..${defaultBranchRef}`])
			: 0;

		return {
			repositoryName: vscode.workspace.asRelativePath(repository.rootUri, false),
			branchName,
			upstreamBehind,
			defaultAhead,
			defaultBranchRef
		};
	}

	private async getUpstreamBehind(repository: GitRepository, head: GitBranch): Promise<number> {
		if (typeof head.behind === 'number') {
			return head.behind;
		}

		if (!head.upstream) {
			return 0;
		}

		return getCommitCount(repository.rootUri, ['rev-list', '--count', `HEAD..${getRemoteBranchRef(head.upstream)}`]);
	}

	private getActiveRepository(): GitRepository | undefined {
		const repositories = this.gitApi?.repositories ?? [];

		if (repositories.length === 0) {
			return undefined;
		}

		const activeFile = vscode.window.activeTextEditor?.document.uri;

		if (activeFile) {
			const matchingRepository = repositories
				.filter(repository => activeFile.fsPath.startsWith(repository.rootUri.fsPath))
				.sort((left, right) => right.rootUri.fsPath.length - left.rootUri.fsPath.length)[0];

			if (matchingRepository) {
				return matchingRepository;
			}
		}

		return repositories[0];
	}

	private createTooltip(signal: RepositorySignal, clickable: boolean): vscode.MarkdownString {
		const tooltip = new vscode.MarkdownString(undefined, true);
		tooltip.isTrusted = true;
		tooltip.appendMarkdown(`**${signal.repositoryName}** on \`${signal.branchName}\`\n\n`);

		if (signal.upstreamBehind > 0) {
			tooltip.appendMarkdown(`$(cloud-download) Upstream has **${signal.upstreamBehind}** commit${pluralize(signal.upstreamBehind)} to pull.\n\n`);
		}

		if (signal.defaultAhead > 0 && signal.defaultBranchRef) {
			tooltip.appendMarkdown(`$(git-compare) \`${signal.defaultBranchRef}\` is **${signal.defaultAhead}** commit${pluralize(signal.defaultAhead)} ahead of this branch.\n\n`);
		}

		if (signal.upstreamBehind === 0 && signal.defaultAhead === 0) {
			tooltip.appendMarkdown('No remote commits are currently missing from this branch.\n\n');
		}

		if (clickable) {
			tooltip.appendMarkdown('Click to fetch and refresh.');
		}

		return tooltip;
	}

	private showMissingGitExtension(): void {
		this.statusBarItem.text = '$(warning) Git alert unavailable';
		this.statusBarItem.tooltip = 'The built-in VS Code Git extension is not available or is disabled.';
		this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
		this.statusBarItem.show();
	}
}

export function activate(context: vscode.ExtensionContext): void {
	const alert = new GitRemoteChangesAlert(context);
	context.subscriptions.push(alert);
	void alert.start();
}

export function deactivate(): void {}

export function formatStatusText(signal: Pick<RepositorySignal, 'upstreamBehind' | 'defaultAhead' | 'defaultBranchRef'>): string {
	const parts: string[] = [];

	if (signal.upstreamBehind > 0) {
		parts.push(`$(cloud-download) ${signal.upstreamBehind}`);
	}

	if (signal.defaultAhead > 0) {
		parts.push(`$(git-compare) ${formatDefaultBranchName(signal.defaultBranchRef)} ${signal.defaultAhead}`);
	}

	return parts.join('  ');
}

export function formatDefaultBranchName(defaultBranchRef: string | undefined): string {
	if (!defaultBranchRef) {
		return 'default';
	}

	const parts = defaultBranchRef.split('/');
	return parts[parts.length - 1] || defaultBranchRef;
}

function getConfiguration<T>(key: string, fallback: T, scope?: vscode.Uri): T {
	return vscode.workspace.getConfiguration(extensionId, scope).get<T>(key, fallback);
}

async function findDefaultBranchRef(repository: GitRepository, preferredRemote: string | undefined): Promise<string | undefined> {
	const configuredBranch = getConfiguration<string>('defaultBranch', '', repository.rootUri).trim();

	if (configuredBranch) {
		return normalizeDefaultBranchRef(configuredBranch, preferredRemote ?? 'origin');
	}

	const remote = preferredRemote ?? 'origin';
	const candidates = unique([
		await getRemoteHeadRef(repository.rootUri, remote),
		await getRemoteHeadRef(repository.rootUri, 'origin'),
		`${remote}/main`,
		`${remote}/master`,
		'origin/main',
		'origin/master'
	]);

	for (const candidate of candidates) {
		if (candidate && await refExists(repository.rootUri, candidate)) {
			return candidate;
		}
	}

	return undefined;
}

async function getRemoteHeadRef(rootUri: vscode.Uri, remote: string): Promise<string | undefined> {
	try {
		const remoteHead = await runGit(rootUri, ['symbolic-ref', '--quiet', '--short', `refs/remotes/${remote}/HEAD`]);
		return remoteHead?.trim() || undefined;
	} catch {
		return undefined;
	}
}

async function refExists(rootUri: vscode.Uri, ref: string): Promise<boolean> {
	try {
		await runGit(rootUri, ['rev-parse', '--verify', `${ref}^{commit}`]);
		return true;
	} catch {
		return false;
	}
}

async function getCommitCount(rootUri: vscode.Uri, args: string[]): Promise<number> {
	try {
		const output = await runGit(rootUri, args);
		const count = Number.parseInt(output.trim(), 10);
		return Number.isFinite(count) ? count : 0;
	} catch {
		return 0;
	}
}

function runGit(rootUri: vscode.Uri, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile('git', ['-C', rootUri.fsPath, ...args], { timeout: 10_000 }, (error, stdout, stderr) => {
			if (error) {
				reject(new Error(stderr.trim() || error.message));
				return;
			}

			resolve(stdout);
		});
	});
}

function getRemoteBranchRef(upstream: GitUpstreamBranch): string {
	return upstream.name.startsWith(`${upstream.remote}/`) ? upstream.name : `${upstream.remote}/${upstream.name}`;
}

function normalizeDefaultBranchRef(branch: string, remote: string): string {
	if (branch.startsWith('refs/remotes/')) {
		return branch.slice('refs/remotes/'.length);
	}

	if (branch.startsWith('refs/heads/')) {
		return `${remote}/${branch.slice('refs/heads/'.length)}`;
	}

	return branch.includes('/') ? branch : `${remote}/${branch}`;
}

function isCurrentBranchDefault(branchName: string, defaultBranchRef: string): boolean {
	return branchName === formatDefaultBranchName(defaultBranchRef);
}

function unique(values: Array<string | undefined>): string[] {
	return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function pluralize(count: number): string {
	return count === 1 ? '' : 's';
}