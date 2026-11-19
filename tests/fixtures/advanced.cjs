module.exports = [
  ['python', `def traced(f):
    return f

class Batch:
    @traced
    async def items(self, values):
        selected = [v for v in values if v > 0]
        for value in selected:
            if value == 2:
                continue
            yield await self.fetch(value)
`],
  ['java', `interface Score<T> { int score(T value); }
class Scores implements Score<Integer> {
    public int score(Integer value) {
        return switch (value) {
            case 0 -> 10;
            default -> score(value - 1);
        };
    }
}`],
  ['c', `#include <vector>
template<typename T> struct Box {
    T *ptr;
    T read() { return *ptr; }
};
int main() {
    std::vector<int> values{1, 2};
    auto twice = [](int n) { return n * 2; };
    for (auto &v : values) {
        if (v < 0) continue;
        v = twice(v);
    }
    return 0;
}`]
];
