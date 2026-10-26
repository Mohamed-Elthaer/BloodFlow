
# from vam import vam
# import config

# # تشغيل VAM بالبيانات الأصلية
# initial, z0, steps = vam(
#     config.SOURCES,
#     config.DESTS,
#     config.COST,
#     config.SUPPLY,
#     config.DEMAND,
#     config.PROHIBITED,
#     config.CAPACITY,
#     verbose=False
# )

# print("=== Initial Allocation ===")
# print(initial)

# print("\n=== Initial Cost ===")
# print(z0)

# print("\n=== VAM Steps ===")
# print(steps.to_string(index=False))

# print("\n=== Validation ===")

# for s in config.SOURCES:
#     print(
#         s,
#         "Supply:",
#         config.SUPPLY[s],
#         "Allocated:",
#         initial.loc[s].sum()
#     )

# for d in config.DESTS:
#     print(
#         d,
#         "Demand:",
#         config.DEMAND[d],
#         "Received:",
#         initial[d].sum()
#     )

# print(
#     "S3 -> D4:",
#     initial.loc["S3", "D4"],
#     "/ Max: 50"
# )

# print(
#     "S3 -> D2:",
#     initial.loc["S3", "D2"],
#     "(Prohibited)"
# )

print("\n=== Capacity Validation ===")

for (s, d), cap in config.CAPACITY.items():
    allocated = initial.loc[s, d]
    print(f"{s} -> {d}: {allocated} / Max: {cap}")
    assert allocated <= cap + 1e-8

print("\n=== Prohibited Validation ===")

for s, d in config.PROHIBITED:
    allocated = initial.loc[s, d]
    print(f"{s} -> {d}: {allocated} (Prohibited)")
    assert abs(allocated) <= 1e-8