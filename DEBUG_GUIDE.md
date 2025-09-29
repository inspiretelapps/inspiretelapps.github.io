# 🐛 Debug Guide for Yeastar Dashboard

## 🎯 Overview

This guide will help you diagnose and fix the two main issues:
1. **Extension Stats showing 0/0**
2. **Route Switching not updating on PBX**

---

## 📊 Issue 1: Extension Stats Showing 0/0

### What I've Added

I've added comprehensive logging to see exactly what the Yeastar API returns. When you load the dashboard:

1. **Open Browser Console** (F12 or Right-click → Inspect → Console)
2. **Connect to your PBX**
3. **Look for these logs:**

```
🔍 FETCHING STATS: { endpoint, extensionIds, startTime, endTime }
📊 RAW STATS RESPONSE: [Complete JSON response]
📋 Stats list found: [Array of extension stats]
📞 COMPLETE EXTENSION DATA: [Shows ALL fields for each extension]
```

### What to Look For

The `📞 COMPLETE EXTENSION DATA` log will show you:
- `ALL_FIELDS`: List of all available field names
- `FULL_OBJECT`: Complete data for each extension

### Finding the Correct Field Names

Once you see the console output, look for fields that contain call counts. Common Yeastar field names:
- `inbound_calls`, `answered_inbound_calls`, `incoming_calls`
- `outbound_calls`, `answered_outbound_calls`, `outgoing_calls`
- `in_answered`, `out_answered`
- `talk_duration`, `total_talking_time`

**Copy the exact field names** you see and let me know. I'll update the code to use them.

### Current Field Names Being Checked

The code currently checks for these variations:
```javascript
inbound_answered_calls
answered_inbound_calls
inbound_calls
incoming_calls
answered_incoming_calls
inbound_talking
in_calls

outbound_answered_calls
answered_outbound_calls
outbound_calls
outgoing_calls
answered_outgoing_calls
outbound_talking
out_calls
```

---

## 🔀 Issue 2: Route Switching Not Working

### What I've Added

Comprehensive logging for every step of the route switching process:

1. **When you click a route button**, look for these logs:

```
🔀 SWITCH TO ROUTE CALLED: { targetRouteId, pattern }
📋 All routes fetched: [Complete route list]
📍 All route positions: [Array showing each route's position]
🔄 Updating routes: [Shows which routes are being swapped]
📤 Target payload: [Data being sent to API]
📤 Current payload: [Data being sent to API]
📥 Target route update result: [API response]
📥 Current route update result: [API response]
✅ Both routes updated successfully!
🔍 Verifying new positions: [Positions after update]
```

### What to Check

1. **Are the API calls successful?**
   - Look for `errcode: 0` in the update results
   - Any other `errcode` means an error occurred

2. **Are positions actually swapping?**
   - Compare "All route positions" BEFORE and AFTER
   - The two routes should have swapped their `pos` values

3. **Common Issues:**

   **Issue: API returns error code**
   - Check the `errmsg` field for details
   - You may need different fields in the payload
   
   **Issue: Updates succeed but positions don't change on PBX**
   - The Yeastar API might cache route positions
   - Try refreshing the PBX web interface
   - The change might take a few seconds to propagate

   **Issue: Wrong routes are being grouped**
   - The grouping logic looks for routes with the same DID pattern
   - Or routes with similar names (like "In_0202" and "In_0202_VM")
   - Check if your routes follow this naming convention

### Debugging Steps

1. **Click the route switching button**
2. **Watch the console** for all the emoji-prefixed logs
3. **Copy the entire console output** and send it to me
4. **Check your PBX web interface** to see if positions changed

### Known Limitations

According to the [Yeastar P-Series API documentation](https://help.yeastar.com/en/p-series-cloud-edition/developer-guide/about-this-guide.html), some fields might be read-only or require specific formats. If the route updates succeed in the API but don't reflect on the PBX, we may need to:

1. Use a different API endpoint
2. Send additional required fields
3. Call a separate "apply changes" endpoint

---

## 🎨 UI Improvements Made

I've significantly enhanced the visual design:

### ✨ What's New

1. **Gradient backgrounds** for a modern look
2. **Animated cards** that lift on hover
3. **Improved buttons** with ripple effects and shadows
4. **Better typography** with gradient text on the header
5. **Colored accent bars** on card headers
6. **Enhanced badges** with shadows and better colors
7. **Responsive design** that works on mobile devices
8. **Smooth animations** throughout
9. **Better stat cards** with improved visual hierarchy
10. **Accessibility improvements** with focus indicators

### Visual Changes

- **Header**: Now has a gradient title and is contained in its own card
- **Buttons**: Gradient primary buttons, lift effect on hover
- **Cards**: Subtle lift on hover, better shadows
- **Stats**: Improved layout with colored backgrounds
- **Tables**: Better spacing, hover effects on rows
- **Inputs**: Focus glow effect
- **Overall**: More modern, clean, professional appearance

---

## 🔧 Next Steps

### For Extension Stats:
1. Open console and connect to PBX
2. Find the `📞 COMPLETE EXTENSION DATA` logs
3. Share the field names you see with me
4. I'll update the code to use the correct fields

### For Route Switching:
1. Open console
2. Try switching a route
3. Copy ALL console logs (especially emoji ones)
4. Check if the PBX web interface shows the change
5. Share the logs with me

### For Testing:
```bash
# Test everything with console open
1. Connect to PBX
2. Wait for stats to load → Check console
3. Try quick route override → Check console
4. Try route switching → Check console
5. Share any errors or unexpected values
```

---

## 📚 Yeastar API Resources

- [API Introduction](https://help.yeastar.com/en/p-series-cloud-edition/developer-guide/about-this-guide.html)
- Your proxy is handling CORS correctly
- All API calls are logged in the console
- Look for `errcode: 0` for successful calls

---

## 💡 Tips

1. **Always have console open** when testing
2. **Use the emoji icons** to quickly find relevant logs
3. **Copy logs immediately** when you see an issue
4. **Test one feature at a time** to isolate problems
5. **Refresh the PBX web interface** after making changes

---

## 🚀 Quick Test Checklist

- [ ] Open browser console (F12)
- [ ] Connect to PBX
- [ ] Check for `📊 RAW STATS RESPONSE` log
- [ ] Look at `📞 COMPLETE EXTENSION DATA` fields
- [ ] Note which fields have call count data
- [ ] Try clicking a route switch button
- [ ] Watch for `🔀 SWITCH TO ROUTE CALLED` log
- [ ] Check for `✅ Both routes updated successfully!`
- [ ] Verify positions in `🔍 Verifying new positions` log
- [ ] Check PBX web interface for actual changes

---

**Last Updated**: September 29, 2025

Share the console logs with me and we'll get this working! 🎯
