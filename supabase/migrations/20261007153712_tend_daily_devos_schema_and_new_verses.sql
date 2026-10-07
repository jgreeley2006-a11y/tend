insert into public.verses (n, ref, text) values
(54, $t$Matthew 9:36$t$, $t$But when he saw the multitudes, he was moved with compassion on them, because they fainted, and were scattered abroad, as sheep having no shepherd.$t$),
(55, $t$Luke 19:5$t$, $t$And when Jesus came to the place, he looked up, and saw him, and said unto him, Zacchaeus, make haste, and come down; for to day I must abide at thy house.$t$),
(56, $t$Mark 10:21$t$, $t$Then Jesus beholding him loved him.$t$),
(57, $t$Luke 10:33$t$, $t$But a certain Samaritan, as he journeyed, came where he was: and when he saw him, he had compassion on him.$t$),
(58, $t$Acts 17:27$t$, $t$That they should seek the Lord, if haply they might feel after him, and find him, though he be not far from every one of us.$t$),
(59, $t$1 Timothy 2:1$t$, $t$I exhort therefore, that, first of all, supplications, prayers, intercessions, and giving of thanks, be made for all men.$t$),
(60, $t$Romans 10:1$t$, $t$Brethren, my heart's desire and prayer to God for Israel is, that they might be saved.$t$),
(61, $t$Colossians 4:3$t$, $t$Withal praying also for us, that God would open unto us a door of utterance, to speak the mystery of Christ.$t$),
(62, $t$Luke 18:1$t$, $t$And he spake a parable unto them to this end, that men ought always to pray, and not to faint.$t$),
(63, $t$2 Corinthians 4:4$t$, $t$In whom the god of this world hath blinded the minds of them which believe not, lest the light of the glorious gospel of Christ, who is the image of God, should shine unto them.$t$),
(64, $t$Philippians 1:3$t$, $t$I thank my God upon every remembrance of you.$t$),
(65, $t$1 Peter 3:15$t$, $t$But sanctify the Lord God in your hearts: and be ready always to give an answer to every man that asketh you a reason of the hope that is in you with meekness and fear.$t$),
(66, $t$John 9:25$t$, $t$He answered and said, Whether he be a sinner or no, I know not: one thing I know, that, whereas I was blind, now I see.$t$),
(67, $t$James 1:19$t$, $t$Wherefore, my beloved brethren, let every man be swift to hear, slow to speak, slow to wrath.$t$),
(68, $t$John 1:46$t$, $t$And Nathanael said unto him, Can there any good thing come out of Nazareth? Philip saith unto him, Come and see.$t$),
(69, $t$Mark 5:19$t$, $t$Howbeit Jesus suffered him not, but saith unto him, Go home to thy friends, and tell them how great things the Lord hath done for thee, and hath had compassion on thee.$t$),
(70, $t$Ecclesiastes 11:6$t$, $t$In the morning sow thy seed, and in the evening withhold not thine hand: for thou knowest not whether shall prosper, either this or that, or whether they both alike shall be good.$t$),
(71, $t$Luke 15:20$t$, $t$And he arose, and came to his father. But when he was yet a great way off, his father saw him, and had compassion, and ran, and fell on his neck, and kissed him.$t$),
(72, $t$Romans 12:13$t$, $t$Distributing to the necessity of saints; given to hospitality.$t$),
(73, $t$Hebrews 13:2$t$, $t$Be not forgetful to entertain strangers: for thereby some have entertained angels unawares.$t$),
(74, $t$John 13:35$t$, $t$By this shall all men know that ye are my disciples, if ye have love one to another.$t$),
(75, $t$Romans 12:10$t$, $t$Be kindly affectioned one to another with brotherly love; in honour preferring one another.$t$),
(76, $t$Acts 2:46$t$, $t$And they, continuing daily with one accord in the temple, and breaking bread from house to house, did eat their meat with gladness and singleness of heart.$t$),
(77, $t$Galatians 6:10$t$, $t$As we have therefore opportunity, let us do good unto all men, especially unto them who are of the household of faith.$t$);

create table public.devotionals (
  n int primary key references public.verses(n),
  title text not null,
  body text not null,
  today text,
  pray text,
  updated_at timestamptz not null default now()
);
alter table public.devotionals enable row level security;
create policy "anyone signed in reads devotionals" on public.devotionals for select to authenticated using (true);
revoke all on public.devotionals from anon, authenticated;
grant select on public.devotionals to authenticated;
comment on table public.devotionals is 'Tend daily devo: one per verse, same n as verses, so the in-app devo matches the verse of the day.';