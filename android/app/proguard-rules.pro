# JS bridge: the WebView calls these by name via reflection.
-keepclassmembers class com.mohdshayan.loopwright.MainActivity$Native { public *; }
-keep class com.mohdshayan.loopwright.MainActivity$Native { *; }
