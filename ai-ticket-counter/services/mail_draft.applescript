-- Apple Mail に下書きメールを作成して表示する。
-- 引数: item1=件名, item2=本文, item3=宛先(カンマ区切り。空可)
-- visible:true で下書きを画面に表示し、ユーザーが内容を確認して送信できるようにする。
on run argv
	set theSubject to item 1 of argv
	set theBody to item 2 of argv
	set theTo to ""
	if (count of argv) ≥ 3 then set theTo to item 3 of argv

	tell application "Mail"
		set newMsg to make new outgoing message with properties {subject:theSubject, content:theBody, visible:true}
		if theTo is not "" then
			set AppleScript's text item delimiters to ","
			repeat with addrRef in (text items of theTo)
				set a to (contents of addrRef)
				if a is not "" then
					tell newMsg to make new to recipient at end of to recipients with properties {address:a}
				end if
			end repeat
			set AppleScript's text item delimiters to ""
		end if
		activate
	end tell
end run
