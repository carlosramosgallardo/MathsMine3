package xyz.mathsmine3.nativeapp

import android.view.MotionEvent
import android.view.View

fun View.keepParentFromStealingTouches(event: MotionEvent) {
    when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> parent?.requestDisallowInterceptTouchEvent(true)
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> parent?.requestDisallowInterceptTouchEvent(false)
    }
}
