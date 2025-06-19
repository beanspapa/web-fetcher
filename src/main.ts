/**
 * 뉴스 컨텐츠 추출기 메인 진입점
 */

console.log('뉴스 컨텐츠 추출기 시작...');

export function main(): void {
  console.log('Hello, Web Fetcher!');
}

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 