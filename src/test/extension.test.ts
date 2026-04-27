import * as assert from 'assert';
import { formatDefaultBranchName, formatStatusText } from '../extension';

suite('Git Remote Changes Alert', () => {
	test('formats upstream commits to pull', () => {
		assert.strictEqual(formatStatusText({ upstreamBehind: 3, defaultAhead: 0 }), '$(cloud-download) 3');
	});

	test('formats default branch drift', () => {
		assert.strictEqual(
			formatStatusText({ upstreamBehind: 0, defaultAhead: 2, defaultBranchRef: 'origin/main' }),
			'$(git-compare) main 2'
		);
	});

	test('formats combined upstream and default branch drift', () => {
		assert.strictEqual(
			formatStatusText({ upstreamBehind: 1, defaultAhead: 4, defaultBranchRef: 'upstream/trunk' }),
			'$(cloud-download) 1  $(git-compare) trunk 4'
		);
	});

	test('formats default branch display name', () => {
		assert.strictEqual(formatDefaultBranchName('origin/main'), 'main');
		assert.strictEqual(formatDefaultBranchName(undefined), 'default');
	});
});