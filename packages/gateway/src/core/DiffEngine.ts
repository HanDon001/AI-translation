/**
 * LCS 差异计算结果
 */
export interface DiffResult {
  startOffset: number;
  endOffset: number;
  replacedText: string;
}

/**
 * LCS 最长公共子序列引擎
 * 基于动态规划，用于计算两个短字符串之间的差异区间
 */
export class DiffEngine {
  /**
   * 计算 oldText -> newText 的差异
   * 返回被替换的区间及新文本
   */
  calculateDiff(oldText: string, newText: string): DiffResult {
    const m = oldText.length;
    const n = newText.length;

    // DP 表: LCS 长度
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldText[i - 1] === newText[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // 找到第一个不匹配的字符位置（从前向后扫描）
    let startOffset = 0;
    while (startOffset < m && startOffset < n && oldText[startOffset] === newText[startOffset]) {
      startOffset++;
    }

    // 找到最后一个不匹配的字符位置（从后向前扫描）
    let endOffset = m;
    let suffixMatch = 0;
    while (
      endOffset > startOffset &&
      m - suffixMatch - 1 >= startOffset &&
      n - suffixMatch - 1 >= startOffset &&
      oldText[m - suffixMatch - 1] === newText[n - suffixMatch - 1]
    ) {
      suffixMatch++;
      endOffset--;
    }

    return {
      startOffset,
      endOffset,
      replacedText: newText.slice(startOffset, n - suffixMatch),
    };
  }
}
