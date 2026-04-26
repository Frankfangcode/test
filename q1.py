n, t = input().split()
n, t = int(n), float(t)
nums = list(map(int, input().split()))

avg = sum(nums) / n
deviations = [x - avg for x in nums]
notable = [d for d in deviations if abs(d) > t]

print(f"Average: {avg:.2f}")
if notable:
    print("Deviations: " + " ".join(f"{d:.2f}" for d in notable))
else:
    print("Deviations: []")
