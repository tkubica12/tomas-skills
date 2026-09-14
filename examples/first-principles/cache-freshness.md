# Why a cache can be fast and wrong

**Example prompt**

> Explain from first principles why a cache can make a system faster while
> returning an outdated answer. Use a small fictional example, work through a
> change in the source data, and show when a time-to-live rule fails to provide
> the freshness guarantee someone might expect. No browsing.

---

A cache buys speed by reusing an earlier answer instead of asking for a new one.
That changes two things at once: the work needed to answer and the moment in
history the answer describes. Freshness is the cost of not observing the source
again, not a mysterious defect added by caching software.

## One answer now, a different answer later

Consider a fictional shop with one authoritative price record and a nearby copy
used by its website. Assume that reading the nearby copy is faster than reading
the authoritative record. There are no network failures, replicas, concurrent
refreshes, or background updates in this initial model.

At 10:00, the website asks for a price. The copy is empty, so it reads 20 from the
source, stores that answer, and returns 20. The cache records a fixed expiry of
10:05. Reading an existing entry does not extend its expiry.

At 10:01, the source price becomes 25. The copy receives no notification.
At 10:02, another customer asks. The cache finds an unexpired answer and returns
20 without contacting the source.

The request is fast for exactly the reason it can be wrong: it does not perform
the observation that would reveal the change.

Three ingredients suffice to produce this behavior: a mutable source, a retained
copy, and a rule that permits using the copy without rechecking. Remove source
changes and the discrepancy disappears. Recheck on every read and this particular
discrepancy disappears, but so does the saving from skipping that check. Retaining
the expensive result may still save other work, so validation is not necessarily
equivalent to abandoning caching.

## Expiry limits reuse, not every kind of staleness

Under the stated model, a request at or after 10:05 must stop using the cached
entry and obtain the current price. That is what the five-minute time-to-live
rule means here: permission to reuse this entry ends five minutes after it was
stored.

It does not mean that the cache learns about a change within five minutes by
itself. With refresh only on demand, there might be no next request for hours.
The distinction matters: an old entry can remain in storage without being
eligible to answer a request.

Nor does an expiry rule automatically bound the age of the underlying
information. Change one assumption: suppose the refresh reads a replica that is
already ten minutes behind the source. The newly stored answer gets a new
five-minute lifetime, but its information was old before that lifetime began.
Expiry bounds residence time in this cache, not the age of every observation
upstream of it.

Another implementation might serve an expired value while refreshing in the
background. That can reduce waiting, but it changes the guarantee. A statement
about freshness must specify both what the refresh reads and what readers receive
while it happens.

## The connection is to an inspection schedule

A useful analogy is a fictional noticeboard checked periodically against a
master timetable. Map the stored price to the copied timetable, the source read
to an inspection, and the expiry rule to a deadline after which the copy is no
longer trusted.

The shared structure is not simply "both store information." Both allow decisions
between observations of a changing world. Shortening the gap creates more
opportunities to detect change but requires more checks. That suggests a design
question for the cache: does this value need frequent observation, or can a
particular operation tolerate an older answer?

The analogy also exposes a limit. A timetable inspector might notice a change
between scheduled visits; our original cache cannot. Adding a change notification
creates a new information path. It is not a property of the expiry rule.

For the shop, that suggests treating a displayed browsing price differently from
the price accepted during checkout. If the requirement is that a purchase uses
the current authoritative price, the purchase operation needs an authoritative
validation consistent with that requirement. Making every cached copy short-lived
is not the same guarantee.

## Change one rule and the models separate

Suppose two engineers disagree about the implementation. One says expiry is fixed
when the entry is stored. The other says each successful read restarts the
five-minute timer.

A controlled example can distinguish them. Keep the authoritative source
immediately readable, disable other refresh paths, load the entry at 10:00, and
change the source at 10:01. Send a read every minute.

The fixed-expiry model predicts a source read at 10:05 and a return of 25. The
sliding-expiry model predicts continued returns of 20: every read arrives before
expiry and extends reuse. Stop the reads long enough and that second behavior
changes again.

If the observed system keeps returning 20 beyond 10:05, that challenges the
fixed-expiry model under these conditions. It does not by itself prove sliding
expiry; a stale upstream replica or serving expired entries could also explain
it. Record whether a source read occurred and which value it returned to separate
those alternatives.

## The guarantee belongs to the whole read path

The question is not just "Does it have a cache?" It is: what fact was observed,
where was it observed, how long may that observation be reused, and which
operation requires a new observation?

Once those conditions are explicit, speed and freshness stop being contradictory
properties. They are consequences of different choices about when the system
must pay for new information.

*All names, prices, times, and behaviors above are illustrative assumptions or
deductions from them, not measurements of a real product.*
