module.exports = {
  testEnvironment: "node",
  // vscode-jest の保存設定でテストを実行するため、ルートから test ディレクトリを削除
  roots: ["<rootDir>"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};
